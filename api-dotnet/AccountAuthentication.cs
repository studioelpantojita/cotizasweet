using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

/// <summary>Explicit application-account trust, independent from the optional external OIDC issuer.</summary>
public static class AccountAuthentication
{
    public const string Selector="CotizaIdentity";
    public const string Scheme="ApplicationAccounts";
    public static AuthenticationBuilder AddAccounts(this AuthenticationBuilder auth,IConfiguration configuration,IHostEnvironment environment)
    {
        var enabled=configuration["ACCOUNT_AUTH_ENABLED"]=="true";
        var secret=configuration["ACCOUNT_JWT_SECRET"]??"";
        var issuer=configuration["ACCOUNT_ISSUER"]??"";
        if(enabled){
            var origin=configuration["APP_ORIGIN"]??"";
            if(!System.Text.RegularExpressions.Regex.IsMatch(secret,"\\A[0-9a-fA-F]{64}\\z")||issuer!=origin.TrimEnd('/')+"/accounts"||!Uri.TryCreate(origin,UriKind.Absolute,out var url)||
               string.IsNullOrWhiteSpace(url.Host)||url.Port<=0||origin.Any(char.IsWhiteSpace)||origin.Contains('\\')||url.UserInfo!=""||url.AbsolutePath!="/"||url.Query!=""||url.Fragment!=""||
               (url.Scheme!="https"&&!(environment.IsDevelopment()&&url.Scheme=="http"&&new[]{"127.0.0.1","localhost"}.Contains(url.Host))))
                throw new InvalidOperationException("Configura la identidad y el secreto de cuentas de aplicación.");
        }
        auth.AddPolicyScheme(Selector,Selector,options=>options.ForwardDefaultSelector=context=>{
            if(!enabled)return JwtBearerDefaults.AuthenticationScheme;
            var header=context.Request.Headers.Authorization.ToString();
            if(header.StartsWith("Bearer ",StringComparison.OrdinalIgnoreCase)){
                try{var token=new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(header[7..]);if(token.Issuer==issuer)return Scheme;}catch{}
            }
            return JwtBearerDefaults.AuthenticationScheme;
        });
        if(enabled)auth.AddJwtBearer(Scheme,options=>{
            options.MapInboundClaims=false;
            options.TokenValidationParameters=new(){ValidateIssuer=true,ValidIssuer=issuer,ValidateAudience=true,ValidAudience="ea-cotiza-api",ValidateIssuerSigningKey=true,IssuerSigningKey=new SymmetricSecurityKey(Convert.FromHexString(secret)),ValidateLifetime=true,RequireExpirationTime=true,RequireSignedTokens=true,ClockSkew=TimeSpan.FromSeconds(30),ValidAlgorithms=new[]{SecurityAlgorithms.HmacSha256},ValidTypes=new[]{"JWT"}};
            options.Events=new JwtBearerEvents{
                OnTokenValidated=context=>{
                    var user=context.Principal;var sub=user?.FindFirstValue("sub");
                    if(!Guid.TryParseExact(sub,"D",out _)||user?.FindFirst("iat")==null||user.FindFirstValue("role") is not ("admin" or "customer"))context.Fail("Identidad incompleta.");
                    return Task.CompletedTask;
                },
                OnChallenge=async context=>{context.HandleResponse();context.Response.StatusCode=401;context.Response.Headers.WWWAuthenticate="Bearer";await context.Response.WriteAsJsonAsync(new{error="Token inválido o expirado."});},
                OnForbidden=context=>{context.Response.StatusCode=403;return context.Response.WriteAsJsonAsync(new{error="Permiso insuficiente."});}
            };
        });
        return auth;
    }
}
