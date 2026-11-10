using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

var assertions=0;
void Check(bool condition,string label) { if(!condition)throw new Exception(label);assertions++; }
IConfiguration Config(Dictionary<string,string?>? patch=null) {
    var data=new Dictionary<string,string?>{{"OIDC_ISSUER","https://identity.example.test"},{"OIDC_AUDIENCE","cotizasweet"},{"INTEGRATION_SERVICE_KEY",new string('x',48)},{"RUC_SERVICE_URL","http://127.0.0.1:8201"}};
    if(patch!=null)foreach(var entry in patch)data[entry.Key]=entry.Value;
    return new ConfigurationBuilder().AddInMemoryCollection(data).Build();
}
BackendSecurity.ValidateStartup(Config(),new TestEnvironment());assertions++;
foreach(var mediaType in new[]{"application/json","Application/JSON; charset=\"UTF-8\""})Check(BackendSecurity.IsUtf8JsonContentType(mediaType),"Valid UTF-8 JSON rejected");
foreach(var mediaType in new[]{"application/jsonp","text/plain","application/problem+json","application/json; charset=latin1","application/json; charset=\"UTF-16\"","application/json; charset=utf8"})Check(!BackendSecurity.IsUtf8JsonContentType(mediaType),"Unsupported JSON media type/charset accepted");
foreach(var patch in new Dictionary<string,string?>[]{
    new(){{"OIDC_ISSUER","http://127.0.0.1:9200"}},
    new(){{"OIDC_ISSUER","https://user:secret@identity.example.test"}},
    new(){{"OIDC_ISSUER","https://identity.example.test?q=secret"}},
    new(){{"OIDC_AUDIENCE"," "}},
    new(){{"INTEGRATION_SERVICE_KEY","short"}},
    new(){{"INTEGRATION_SERVICE_KEY",new string('é',48)}},
    new(){{"INTEGRATION_SERVICE_KEY",new string('x',47)+" "}},
    new(){{"OIDC_ALLOW_LOCAL_HTTP","true"}}
}){
    var rejected=false;try{BackendSecurity.ValidateStartup(Config(patch),new TestEnvironment());}catch(InvalidOperationException){rejected=true;}
    Check(rejected,"Unsafe production configuration accepted");
}
BackendSecurity.ValidateStartup(Config(new(){{"OIDC_ISSUER","http://127.0.0.1:9200"},{"OIDC_ALLOW_LOCAL_HTTP","true"}}),new TestEnvironment{EnvironmentName="Development"});assertions++;

foreach(var address in new[]{"http://external.example.test","ftp://localhost","https://user:secret@internal.example.test","https://internal.example.test/?token=secret","http://api-python.railway.internal.evil.example","http://evil.railway.internal","http://api-python.railway.internal/path","http://api-python.railway.internal:0"}){
    var rejected=false;try{_ = new RucClient(new HttpClient(),Config(new(){{"RUC_SERVICE_URL",address}}));}catch(InvalidOperationException){rejected=true;}
    Check(rejected,"Unsafe service URL accepted");
}
_ = new RucClient(new HttpClient(),Config(new(){{"RUC_SERVICE_URL","http://api-python.railway.internal:8000"}}));assertions++;
var client=new RucClient(new HttpClient(),Config());
Check(client.Authorized(new string('x',48)),"Matching key rejected");
Check(!client.Authorized(null)&&!client.Authorized("bad")&&!client.Authorized(new string('é',48)),"Invalid key accepted");
foreach(var sample in new[]{
    (200,"[]"),(200,"{\"ruc\":123,\"legalName\":[]}"),(200,"not json"),(200,new string('x',16385)),(500,"{\"error\":\"private-example\"}"),(404,"{\"error\":\"private-example\"}"),(429,"{\"error\":\"private-example\"}")
}){
    using var http=new HttpClient(new StaticHandler(sample.Item1,sample.Item2));
    var service=new RucClient(http,Config());
    try{await service.Lookup("20999999990");throw new Exception("Malformed upstream response accepted");}
    catch(RucException error){Check(!error.Message.Contains("private-example")&&error.Status==(sample.Item1==404?404:sample.Item1==429?429:503),"Unsafe upstream error");}
}
foreach(var mutate in new Action<JsonObject>[] {
    q=>q["unexpectedField"]="x",
    q=>q["items"]![0]!["unexpectedField"]="x",
    q=>q["materials"]![0]!["unexpectedField"]="x",
    q=>q["materials"]![0]!["configuration"]!["unexpectedField"]="x",
    q=>q["clientLookup"]!["unexpectedField"]="x"
}){
    var quote=JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"contracts","example-quote.json")))!.AsObject();
    quote["clientLookup"]=JsonNode.Parse("{\"ruc\":\"20999999990\",\"legalName\":\"Synthetic identity\",\"status\":\"DEMO\",\"condition\":\"DEMO\",\"source\":\"Isolated test\",\"checkedAt\":\"2026-11-10T10:00:00Z\",\"demo\":true}");
    mutate(quote);
    var rejected=false;try{QuoteDomain.Validate(quote,creating:true);}catch(ArgumentException){rejected=true;}
    Check(rejected,"Unknown quote contract property accepted");
}
Console.WriteLine($"PASS: {assertions} .NET backend security assertions");

sealed class TestEnvironment:IHostEnvironment {
    public string EnvironmentName {get;set;}="Production";
    public string ApplicationName {get;set;}="SecurityChecks";
    public string ContentRootPath {get;set;}=Directory.GetCurrentDirectory();
    public IFileProvider ContentRootFileProvider {get;set;}=new NullFileProvider();
}
sealed class StaticHandler(int status,string body):HttpMessageHandler {
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken cancellation)=>Task.FromResult(new HttpResponseMessage((HttpStatusCode)status){Content=new StringContent(body,Encoding.UTF8,"application/json")});
}
