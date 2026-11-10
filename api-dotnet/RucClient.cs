using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

public sealed class RucException(int status,string message,int? retryAfter=null):Exception(message) { public int Status {get;}=status; public int? RetryAfter {get;}=retryAfter; }
public sealed class RucClient
{
    readonly HttpClient http;
    readonly string secret;
    public RucClient(HttpClient client,IConfiguration config)
    {
        http=client;secret=config["INTEGRATION_SERVICE_KEY"]??"";
        var url=new Uri(config["RUC_SERVICE_URL"]??"http://127.0.0.1:8001");
        if(!string.IsNullOrEmpty(url.UserInfo) || !string.IsNullOrEmpty(url.Query) || !string.IsNullOrEmpty(url.Fragment) || url.AbsolutePath!="/" || url.Port<1 ||
            (url.Scheme!="https" && !(url.Scheme=="http" && new[]{"127.0.0.1","localhost","api-python","api-python.railway.internal"}.Contains(url.Host))))
            throw new InvalidOperationException("El servicio RUC remoto requiere HTTPS.");
        http.BaseAddress=url;http.Timeout=TimeSpan.FromSeconds(12);
    }
    public bool Authorized(string? supplied) => secret.Length>=32 && supplied!=null && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(secret),Encoding.UTF8.GetBytes(supplied));
    public async Task<JsonObject> Lookup(string ruc,CancellationToken cancellation=default)
    {
        if(!QuoteDomain.ValidRuc(ruc))throw new RucException(400,"RUC inválido. Revisa sus 11 dígitos y el dígito verificador.");
        if(secret.Length<32)throw new RucException(503,"Configura la conexión con el servicio RUC.");
        try{
            using var timeout=CancellationTokenSource.CreateLinkedTokenSource(cancellation);
            timeout.CancelAfter(TimeSpan.FromSeconds(12));
            using var request=new HttpRequestMessage(HttpMethod.Get,"/api/clients/ruc/"+ruc);
            request.Headers.Add("X-Service-Key",secret);
            using var response=await http.SendAsync(request,HttpCompletionOption.ResponseHeadersRead,timeout.Token);
            if(!response.IsSuccessStatusCode) {
                var status=(int)response.StatusCode;
                var message=status switch {400=>"RUC inválido. Revisa el documento.",404=>"RUC no encontrado por la fuente configurada.",429=>"Se alcanzó el límite de consultas RUC. Intenta más tarde.",_=>"El servicio RUC no está disponible. Intenta de nuevo."};
                throw new RucException(new[]{400,404,429}.Contains(status)?status:503,message,status==429?60:null);
            }
            await response.Content.LoadIntoBufferAsync(16384,timeout.Token);
            var data=JsonNode.Parse(await response.Content.ReadAsStringAsync(timeout.Token))?.AsObject();
            if(data==null || QuoteDomain.S(data,"ruc")!=ruc || string.IsNullOrWhiteSpace(QuoteDomain.S(data,"legalName")))throw new RucException(503,"Respuesta RUC incongruente.");
            return data;
        }catch(RucException){throw;}catch(Exception e) when(e is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException or InvalidOperationException){throw new RucException(503,"El servicio RUC no está disponible. Intenta de nuevo.");}
    }
    public async Task Verify(JsonObject quote,CancellationToken cancellation=default)
    {
        if(QuoteDomain.DocumentType(quote)!="ruc"){quote.Remove("clientLookup");return;}
        var identity=await Lookup(QuoteDomain.S(quote,"clientDocument"),cancellation);
        if(QuoteDomain.S(quote,"client")!=QuoteDomain.S(identity,"legalName"))throw new RucException(400,"El nombre no coincide con el RUC. Vuelve a consultar el documento.");
        quote["clientLookup"]=identity;
    }
}
