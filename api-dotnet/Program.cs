using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder=WebApplication.CreateBuilder(args);
BackendSecurity.ValidateStartup(builder.Configuration,builder.Environment);
var issuer=builder.Configuration["OIDC_ISSUER"]??throw new InvalidOperationException("Configura OIDC_ISSUER.");
var audience=builder.Configuration["OIDC_AUDIENCE"]??throw new InvalidOperationException("Configura OIDC_AUDIENCE.");
var url=new Uri(issuer);
var local=builder.Environment.IsDevelopment() && builder.Configuration["OIDC_ALLOW_LOCAL_HTTP"]=="true" && new[]{"localhost","127.0.0.1"}.Contains(url.Host);
if(url.Scheme!="https" && !local)throw new InvalidOperationException("OIDC requiere HTTPS.");
builder.WebHost.ConfigureKestrel(options=>options.Limits.MaxRequestBodySize=70000);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options=>{
    options.Authority=issuer;options.Audience=audience;options.RequireHttpsMetadata=!local;options.MapInboundClaims=false;
    options.TokenValidationParameters=new(){ValidateIssuer=true,ValidIssuer=issuer,ValidateAudience=true,ValidAudience=audience,ValidateIssuerSigningKey=true,ValidateLifetime=true,RequireExpirationTime=true,RequireSignedTokens=true,ClockSkew=TimeSpan.FromSeconds(30),ValidAlgorithms=new[]{SecurityAlgorithms.RsaSha256}};
    options.Events=new JwtBearerEvents{
        OnTokenValidated=context=>{if(string.IsNullOrWhiteSpace(context.Principal?.FindFirstValue("sub")) || context.Principal?.FindFirst("iat")==null)context.Fail("Identidad incompleta.");return Task.CompletedTask;},
        OnChallenge=async context=>{context.HandleResponse();context.Response.StatusCode=401;context.Response.Headers.WWWAuthenticate="Bearer";await context.Response.WriteAsJsonAsync(new{error="Token inválido o expirado."});},
        OnForbidden=context=>{context.Response.StatusCode=403;return context.Response.WriteAsJsonAsync(new{error="Permiso insuficiente."});}
    };
});
bool HasScope(ClaimsPrincipal user,string scope)=>user.FindAll("scope").Concat(user.FindAll("scp")).Any(c=>c.Value.Split(' ',StringSplitOptions.RemoveEmptyEntries).Contains(scope));
builder.Services.AddAuthorization(options=>{
    options.AddPolicy("read",p=>p.RequireAuthenticatedUser().RequireAssertion(c=>HasScope(c.User,"quotes:read")));
    options.AddPolicy("write",p=>p.RequireAuthenticatedUser().RequireAssertion(c=>HasScope(c.User,"quotes:write")));
});
builder.Services.AddSingleton(new QuoteStore(builder.Configuration["DATABASE_PATH"]??"./data/dotnet.sqlite"));
builder.Services.AddHttpClient<RucClient>().ConfigurePrimaryHttpMessageHandler(()=>new HttpClientHandler{AllowAutoRedirect=false});
builder.Services.AddSingleton<CatalogStore>();
builder.Services.AddRateLimiter(options=>{
    options.RejectionStatusCode=429;
    options.OnRejected=async(context,cancellation)=>{
        var seconds=context.Lease.TryGetMetadata(MetadataName.RetryAfter,out var remaining)?Math.Max(1,(int)Math.Ceiling(remaining.TotalSeconds)):60;
        context.HttpContext.Response.Headers.RetryAfter=seconds.ToString();
        context.HttpContext.Response.Headers.CacheControl="no-store";
        await context.HttpContext.Response.WriteAsJsonAsync(new{error="Se alcanzó el límite de solicitudes. Intenta más tarde."},cancellation);
    };
    foreach(var policy in new[]{("quote-read",120),("quote-write",120),("ruc",60)})
        options.AddPolicy(policy.Item1,context=>RateLimitPartition.GetFixedWindowLimiter(
            context.User.Identity?.IsAuthenticated==true?Owner(context.User):(context.Connection.RemoteIpAddress?.ToString()??"unknown"),
            _=>new FixedWindowRateLimiterOptions{PermitLimit=policy.Item2,Window=TimeSpan.FromMinutes(1),QueueLimit=0,AutoReplenishment=true}));
});
var app=builder.Build();
// Validate and import the catalog before accepting traffic.
_ = app.Services.GetRequiredService<CatalogStore>();
app.Use(async(context,next)=>{context.Response.Headers.CacheControl="no-store";try{await next();}catch(BadHttpRequestException e){context.Response.StatusCode=e.StatusCode;await context.Response.WriteAsJsonAsync(new{error="Solicitud inválida o demasiado grande."});}catch{context.Response.StatusCode=503;await context.Response.WriteAsJsonAsync(new{error="No se pudo completar la operación."});}});
app.UseAuthentication();app.UseRateLimiter();app.UseAuthorization();
string Owner(ClaimsPrincipal user) {
    var canonical=JsonSerializer.Serialize(new[]{issuer,user.FindFirstValue("sub")!},new JsonSerializerOptions{Encoder=JavaScriptEncoder.UnsafeRelaxedJsonEscaping});
    return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
}
app.MapGet("/api/catalog",(CatalogStore store)=>Results.Json(store.Read()));
app.MapGet("/health",()=>Results.Ok(new{status="ok"}));
app.MapGet("/api/quotes",(ClaimsPrincipal user,QuoteStore store)=>Results.Ok(new{quotes=store.List(Owner(user))})).RequireAuthorization("read").RequireRateLimiting("quote-read");
app.MapGet("/api/clients/ruc/{ruc}",async(string ruc,HttpRequest request,RucClient client)=>{
    if(!client.Authorized(request.Headers["X-Service-Key"]))return Results.Json(new{error="Servicio no autorizado."},statusCode:401);
    try{return Results.Json(await client.Lookup(ruc,request.HttpContext.RequestAborted));}
    catch(RucException e){if(e.RetryAfter is int seconds)request.HttpContext.Response.Headers.RetryAfter=seconds.ToString();return Results.Json(new{error=e.Message},statusCode:e.Status);}
}).RequireRateLimiting("ruc");
app.MapPost("/api/quotes",async(HttpRequest request,ClaimsPrincipal user,QuoteStore store,RucClient ruc)=>{
    if(!BackendSecurity.IsUtf8JsonContentType(request.ContentType))return Results.Json(new{error="Se requiere JSON con codificación UTF-8."},statusCode:415);
    JsonObject quote;
    try{quote=QuoteDomain.Validate(await JsonNode.ParseAsync(request.Body),creating:true);}
    catch(Exception e) when(e is JsonException or ArgumentException or FormatException or InvalidOperationException){return Results.BadRequest(new{error="Cotización inválida. Revisa los campos."});}
    try{await ruc.Verify(quote,request.HttpContext.RequestAborted);}
    catch(RucException e){if(e.RetryAfter is int seconds)request.HttpContext.Response.Headers.RetryAfter=seconds.ToString();return Results.Json(new{error=e.Message},statusCode:e.Status);}
    return Results.Json(store.Save(Owner(user),quote),statusCode:201);
}).RequireAuthorization("write").RequireRateLimiting("quote-write");
app.Run();
public partial class Program {}
