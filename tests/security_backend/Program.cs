using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Data.Sqlite;
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
// History pagination and scheduled backups run against a disposable database.
var scratch=Directory.CreateTempSubdirectory("cotiza-checks-");
try {
    HistoryPage? Page(string query)=>HistoryPage.Parse(new QueryCollection(QueryHelpers.ParseQuery(query)));
    var store=new QuoteStore(Path.Combine(scratch.FullName,"quotes.sqlite"));
    var example=JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"contracts","example-quote.json")))!;
    for(var i=0;i<5;i++)store.Save("owner-a",QuoteDomain.Validate(example.DeepClone(),creating:true));
    store.Save("owner-b",QuoteDomain.Validate(example.DeepClone(),creating:true));
    JsonNode Listed(HistoryPage page,string owner="owner-a")=>JsonSerializer.SerializeToNode(store.List(owner,page))!;
    var full=Listed(Page("")!);
    Check(full["quotes"]!.AsArray().Count==5 && full["nextCursor"]==null,"Full history page is wrong");
    var seen=new List<string>();string? cursor=null;var pages=0;
    do{var page=Listed(Page(cursor==null?"?limit=2":"?limit=2&before="+Uri.EscapeDataString(cursor))!);
       Check(page["quotes"]!.AsArray().Count<=2,"Page ignores limit");seen.AddRange(page["quotes"]!.AsArray().Select(q=>q!["id"]!.GetValue<string>()));
       cursor=page["nextCursor"]?.GetValue<string>();pages++;}while(cursor!=null && pages<10);
    Check(pages==3 && seen.SequenceEqual(full["quotes"]!.AsArray().Select(q=>q!["id"]!.GetValue<string>())),"Pages skip or repeat proposals");
    Check(Listed(Page("?limit=50")!,"owner-c")["quotes"]!.AsArray().Count==0,"Pagination leaks other owners");
    Check(Page("")==new HistoryPage(20) && Page("?limit=50")!.Limit==50,"Valid pagination rejected");
    foreach(var bad in new[]{"?limit=0","?limit=51","?limit=-1","?limit=1.5","?limit=abc","?limit=","?limit=1&limit=2","?before=x","?before=2026-11-13T13:51:14.815Z_' OR 1=1","?before=2026-11-13T13:51:14.815Z_BC85BBF4-BD14-45E8-8932-7AE2A7556630","?before=٢026-11-13T13:51:14.815Z_bc85bbf4-bd14-45e8-8932-7ae2a7556630"})
        Check(Page(bad)==null,"Invalid pagination accepted: "+bad);

    var options=new BackupOptions(Path.Combine(scratch.FullName,"backups"),TimeSpan.FromHours(24),2);
    var start=new DateTime(2026,11,13,10,0,0,DateTimeKind.Utc);
    Directory.CreateDirectory(options.Directory);
    File.WriteAllText(Path.Combine(options.Directory,"notas.txt"),"x");File.WriteAllText(Path.Combine(options.Directory,"quotes-manual.sqlite"),"x");
    var copies=Enumerable.Range(0,3).Select(i=>QuoteBackup.RunOnce(store.DatabasePath,options,start.AddHours(i))).ToList();
    Check(!File.Exists(copies[0]) && !File.Exists(copies[0]+".metadata.json") && File.Exists(copies[1]) && File.Exists(copies[2]),"Backup rotation does not keep the newest copies");
    Check(File.Exists(Path.Combine(options.Directory,"notas.txt")) && File.Exists(Path.Combine(options.Directory,"quotes-manual.sqlite")),"Backup rotation deletes files it did not create");
    Check(!Directory.EnumerateFiles(options.Directory,".snapshot-*").Any(),"Backup leaves temporary files");
    var metadata=JsonNode.Parse(File.ReadAllText(copies[2]+".metadata.json"))!;
    using(var stream=File.OpenRead(copies[2]))
        Check(metadata["schemaVersion"]!.GetValue<int>()==1 && metadata["sqliteIntegrity"]!.GetValue<string>()=="ok" && metadata["bytes"]!.GetValue<long>()==new FileInfo(copies[2]).Length && metadata["sha256"]!.GetValue<string>()==Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant(),"Backup metadata does not match the copy");
    using(var copy=new SqliteConnection($"Data Source={copies[2]};Mode=ReadOnly;Pooling=False")){copy.Open();using var count=copy.CreateCommand();count.CommandText="SELECT count(*) FROM quotes";Check((long)count.ExecuteScalar()! == 6,"Backup misses committed quotes");}
    var duplicate=false;try{QuoteBackup.RunOnce(store.DatabasePath,options,start.AddHours(2));}catch(IOException){duplicate=true;}
    Check(duplicate,"Backup overwrites an existing copy");

    IConfiguration Settings(params (string key,string value)[] values)=>new ConfigurationBuilder().AddInMemoryCollection(values.ToDictionary(v=>v.key,v=>(string?)v.value)).Build();
    var defaults=BackupOptions.From(Settings(),store.DatabasePath);
    Check(defaults.Enabled && defaults.Interval==TimeSpan.FromHours(24) && defaults.Keep==7 && defaults.Directory==Path.Combine(scratch.FullName,"backups"),"Backup defaults changed");
    Check(!BackupOptions.From(Settings(("BACKUP_INTERVAL_HOURS","0")),store.DatabasePath).Enabled,"Backups cannot be disabled");
    foreach(var (key,value) in new[]{("BACKUP_INTERVAL_HOURS","-1"),("BACKUP_INTERVAL_HOURS","169"),("BACKUP_INTERVAL_HOURS","1.5"),("BACKUP_KEEP","0"),("BACKUP_KEEP","366"),("BACKUP_KEEP","x")}) {
        var rejected=false;try{BackupOptions.From(Settings((key,value)),store.DatabasePath);}catch(InvalidOperationException){rejected=true;}
        Check(rejected,$"Invalid {key}={value} accepted");
    }
} finally { SqliteConnection.ClearAllPools(); scratch.Delete(true); }
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
