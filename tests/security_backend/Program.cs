using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Security.Claims;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

if (args.Length == 2 && args[0] == "--backup-fixture")
{
    var folder = Path.GetFullPath(args[1]);
    Directory.CreateDirectory(folder);
    var database = Path.Combine(folder, "dotnet-fixture.sqlite");
    if (File.Exists(database) || Directory.Exists(Path.Combine(folder, "backups")))
        throw new IOException("The fixture requires a new destination.");
    var fixtureStore = new QuoteStore(database);
    var fixtureQuote = JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"contracts","example-quote.json")))!.AsObject();
    for (var index = 0; index < 4; index++)
    {
        var quote = fixtureQuote.DeepClone().AsObject();
        quote["event"] = $"Synthetic backup interoperability {index}";
        fixtureStore.Save("synthetic-fixture-owner", quote);
    }
    var created = new QuoteBackup(database).CreateIfDue(DateTimeOffset.UtcNow);
    if (!created) throw new InvalidOperationException("Fixture backup was not created.");
    SqliteConnection.ClearAllPools();
    Console.WriteLine(JsonSerializer.Serialize(new
    {
        status = "ok",
        source = database,
        snapshot = Directory.GetFiles(Path.Combine(folder,"backups"), "cotiza-*.sqlite").Single()
    }));
    return;
}

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
Check(!OidcProvider.Validate(Config(),new TestEnvironment()),"Standard OIDC profile changed");
Check(OidcProvider.Validate(Config(new(){{"OIDC_PROVIDER","google"},{"OIDC_ISSUER","https://accounts.google.com"},{"OIDC_AUDIENCE","123456-test.apps.googleusercontent.com"}}),new TestEnvironment()),"Google web profile rejected");
foreach(var patch in new Dictionary<string,string?>[]{
    new(){{"OIDC_PROVIDER","other"}},
    new(){{"OIDC_PROVIDER","google"}},
    new(){{"OIDC_PROVIDER","google"},{"OIDC_ISSUER","https://accounts.google.com"},{"OIDC_AUDIENCE","another-audience"}},
}){
    var rejected=false;try{OidcProvider.Validate(Config(patch),new TestEnvironment());}catch(InvalidOperationException){rejected=true;}
    Check(rejected,"Unsafe identity provider accepted");
}
foreach(var verified in new[]{"false","","TRUE"}){
    var user=new ClaimsPrincipal(new ClaimsIdentity(new[]{new Claim("email_verified",verified)}));
    Check(OidcProvider.VerifiedGoogleIdentity(user,"client")== (verified=="TRUE"),"Google email verification ignored");
}
Check(!OidcProvider.VerifiedGoogleIdentity(new ClaimsPrincipal(new ClaimsIdentity(new[]{new Claim("email_verified","true"),new Claim("azp","other")})),"client"),"Google authorized party ignored");
var multipleGoogleAudiences = new[]
{
    new Claim("email_verified","true"), new Claim("aud","client"), new Claim("aud","another-recipient")
};
Check(!OidcProvider.VerifiedGoogleIdentity(new ClaimsPrincipal(new ClaimsIdentity(multipleGoogleAudiences)),"client"),
      "Google token with multiple audiences and no authorized party was accepted");
Check(OidcProvider.VerifiedGoogleIdentity(new ClaimsPrincipal(new ClaimsIdentity(
          multipleGoogleAudiences.Append(new Claim("azp","client")))),"client"),
      "Google token with multiple audiences and matching authorized party was rejected");

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
// Regression for stable paging, legacy/corrupt rows and owner separation.
var historyRoot = Directory.CreateTempSubdirectory("cotiza-history-test-");
try
{
    var database = Path.Combine(historyRoot.FullName, "history.sqlite");
    var store = new QuoteStore(database);
    var payload = JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"contracts","example-quote.json")))!.AsObject();
    const string timestamp = "2026-11-01T12:00:00.000Z";
    string Id(int value) => $"00000000-0000-4000-8000-{value:D12}";
    var oldPayload = payload.DeepClone().AsObject();
    oldPayload["projectType"] = "navidad";
    using (var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = database, Pooling = false }.ToString()))
    {
        db.Open();
        using var transaction = db.BeginTransaction();
        for (var index = 1; index <= 46; index++)
        {
            using var statement = db.CreateCommand();
            statement.Transaction = transaction;
            statement.CommandText = "INSERT INTO quotes VALUES ($id,$owner,$payload,$total,$created)";
            statement.Parameters.AddWithValue("$id", Id(index));
            statement.Parameters.AddWithValue("$owner", index == 46 ? "history-bob" : "history-alice");
            var serialized = index == 7 ? "{" : index == 8 ? oldPayload.ToJsonString() :
                index == 9 ? new string('x', QuoteHistory.PayloadLimit + 1) : payload.ToJsonString();
            statement.Parameters.AddWithValue("$payload", serialized);
            statement.Parameters.AddWithValue("$total", index == 10 ? (object)"invalid-total" : 12345L);
            statement.Parameters.AddWithValue("$created", timestamp);
            statement.ExecuteNonQuery();
        }
        transaction.Commit();
    }
    var first = store.List("history-alice");
    Check(first.Quotes.Count == 20 && first.NextCursor is not null, "History page is not bounded to twenty records");
    Check(first.Quotes[0].Id == Id(45) && first.Quotes[^1].Id == Id(26), "History tie order is unstable");
    Check(QuoteHistory.TryReadCursor(new Microsoft.Extensions.Primitives.StringValues(first.NextCursor), out var cursor) &&
          cursor == new HistoryCursor(timestamp, Id(26)), "History cursor does not preserve its sorting boundary");
    var compatibleCursor = "v1." + Convert.ToBase64String(Encoding.UTF8.GetBytes(timestamp + "|" + Id(26)))
        .TrimEnd('=').Replace('+','-').Replace('/','_');
    Check(first.NextCursor == compatibleCursor, "History cursor differs from the cross-backend format");
    var newRecord = JsonSerializer.SerializeToNode(store.Save("history-alice", payload))!.AsObject();
    var second = store.List("history-alice", cursor);
    Check(second.Quotes.Count == 20 && second.Quotes[0].Id == Id(25) && second.Quotes[^1].Id == Id(6),
          "Concurrent head insert caused a repeated or missing record on the next history page");
    Check(second.Quotes.Single(row => row.Id == Id(7)).Quote is null, "Malformed JSON blocked or contaminated the history page");
    Check(second.Quotes.Single(row => row.Id == Id(8)).Quote?["projectType"]?.GetValue<string>() == "navidad",
          "Legacy quote was discarded instead of being available for individual UI classification");
    Check(second.Quotes.Single(row => row.Id == Id(9)).Quote is null, "Oversized stored payload bypassed the history response bound");
    Check(second.Quotes.Single(row => row.Id == Id(10)).TotalCents is null, "Invalid stored total blocked or falsified the history page");
    Check(QuoteHistory.TryReadCursor(new Microsoft.Extensions.Primitives.StringValues(second.NextCursor), out var finalCursor),
          "Second history cursor is invalid");
    var third = store.List("history-alice", finalCursor);
    Check(third.Quotes.Count == 5 && third.NextCursor is null, "Last history page is incomplete or has a spurious cursor");
    var allIds = first.Quotes.Concat(second.Quotes).Concat(third.Quotes).Select(row => row.Id).ToArray();
    Check(allIds.Length == 45 && allIds.Distinct().Count() == 45, "History traversal duplicated or omitted existing quotes");
    Check(!allIds.Contains(newRecord["id"]!.GetValue<string>()), "Cursor traversal restarted at a newer inserted quote");
    var refreshed = store.List("history-alice");
    Check(refreshed.Quotes[0].Id == newRecord["id"]!.GetValue<string>(), "Refreshing history failed to include the new head record");
    var bob = store.List("history-bob");
    Check(bob.Quotes.Count == 1 && bob.Quotes[0].Id == Id(46), "History leaked another owner's records");
    Check(store.List("history-bob", cursor).Quotes.Count == 0, "A foreign cursor granted access to another owner's quotes");
    Check(store.List("history-alice' OR 1=1 --").Quotes.Count == 0, "Owner SQL input changed the history query");
    Check(QuoteHistory.TryReadCursor(Microsoft.Extensions.Primitives.StringValues.Empty, out var emptyCursor) &&
          emptyCursor is null, "Missing history cursor did not select the first page");
    foreach (var invalid in new[] {
        "", "v0."+compatibleCursor[3..], compatibleCursor+"=", "v1."+new string('A',82),
        "v1."+Convert.ToBase64String(Encoding.UTF8.GetBytes("2026-02-30T12:00:00.000Z|"+Id(26))).TrimEnd('=').Replace('+','-').Replace('/','_'),
        "v1."+Convert.ToBase64String(Encoding.UTF8.GetBytes(timestamp+"|00000000-0000-4000-8000-INVALIDVALUE")).TrimEnd('=').Replace('+','-').Replace('/','_')
    })
        Check(!QuoteHistory.TryReadCursor(new Microsoft.Extensions.Primitives.StringValues(invalid), out _),
              "Malformed history cursor was accepted");
    Check(!QuoteHistory.TryReadCursor(new Microsoft.Extensions.Primitives.StringValues(new[] { compatibleCursor, compatibleCursor }), out _),
          "Duplicate history cursor parameters were accepted");
}
finally
{
    SqliteConnection.ClearAllPools();
    historyRoot.Delete(recursive: true);
}
var backupRoot = Directory.CreateTempSubdirectory("cotiza-backup-test-");
try
{
    var origin = Path.Combine(backupRoot.FullName, "quotes.sqlite");
    var store = new QuoteStore(origin);
    var quote = JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"contracts","example-quote.json")))!.AsObject();
    store.Save("test-owner", quote);
    var backup = new QuoteBackup(origin);
    var day = new DateTimeOffset(2026, 11, 1, 3, 0, 0, TimeSpan.Zero);
    Check(backup.CreateIfDue(day), "First backup missing");
    Check(!new QuoteBackup(origin).CreateIfDue(day.AddHours(23)), "Restart created backup before 24 hours");
    var folder = Path.Combine(backupRoot.FullName, "backups");
    var otherFile = Path.Combine(folder, "manual.sqlite");
    File.WriteAllText(otherFile, "unmanaged");
    for (var i = 1; i <= 8; i++)
        Check(backup.CreateIfDue(day.AddDays(i)), "Scheduled backup missing");
    var snapshots = Directory.GetFiles(folder, "cotiza-*.sqlite").Order(StringComparer.Ordinal).ToArray();
    Check(snapshots.Length == 7 && snapshots[0].Contains("20261103T"), "Retention must keep latest seven backups");
    Check(File.Exists(otherFile), "Backup retention touched an unmanaged file");
    using var meta = JsonDocument.Parse(File.ReadAllBytes(snapshots[^1] + ".metadata.json"));
    Check(meta.RootElement.GetProperty("schemaVersion").GetInt32() == 1 &&
          meta.RootElement.GetProperty("sha256").GetString()?.Length == 64, "Incompatible snapshot metadata");
    using var restored = new SqliteConnection(new SqliteConnectionStringBuilder
        { DataSource = snapshots[^1], Mode = SqliteOpenMode.ReadOnly, Pooling = false }.ToString());
    restored.Open();
    using var statement = restored.CreateCommand();
    statement.CommandText = "SELECT count(*) FROM quotes WHERE owner='test-owner'";
    Check(Convert.ToInt64(statement.ExecuteScalar()) == 1, "WAL snapshot lost a committed quote");
}
finally
{
    SqliteConnection.ClearAllPools();
    backupRoot.Delete(recursive: true);
}
var damagedBackupRoot = Directory.CreateTempSubdirectory("cotiza-backup-integrity-test-");
try
{
    var origin = Path.Combine(damagedBackupRoot.FullName,"quotes.sqlite");
    var store = new QuoteStore(origin);
    var quote = JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"contracts","example-quote.json")))!.AsObject();
    store.Save("synthetic-integrity-owner",quote);
    var backup = new QuoteBackup(origin);
    var start = new DateTimeOffset(2026,11,1,3,0,0,TimeSpan.Zero);
    Check(backup.CreateIfDue(start),"Integrity fixture snapshot was not created");
    var directory = Path.Combine(damagedBackupRoot.FullName,"backups");
    var firstSnapshot = Directory.GetFiles(directory,"cotiza-*.sqlite").Single();
    var originalLength = new FileInfo(firstSnapshot).Length;
    using (var stream = new FileStream(firstSnapshot,FileMode.Open,FileAccess.ReadWrite,FileShare.None))
    {
        stream.Position = stream.Length-1;
        var originalByte = stream.ReadByte();
        stream.Position--;
        stream.WriteByte((byte)(originalByte^1));
        stream.Flush(flushToDisk:true);
    }
    Check(new FileInfo(firstSnapshot).Length==originalLength,"Integrity fixture changed snapshot size");
    Check(backup.CreateIfDue(start.AddMinutes(1)),"Changed snapshot hash delayed replacement until the next daily interval");
    var replacement = Directory.GetFiles(directory,"cotiza-*.sqlite").Single(path=>path!=firstSnapshot);
    using var copy = new SqliteConnection(new SqliteConnectionStringBuilder
        {DataSource=replacement,Mode=SqliteOpenMode.ReadOnly,Pooling=false}.ToString());
    copy.Open();
    using var statement = copy.CreateCommand();
    statement.CommandText = "PRAGMA integrity_check";
    Check((string?)statement.ExecuteScalar()=="ok","Replacement snapshot did not preserve source integrity");
    Check(!backup.CreateIfDue(start.AddMinutes(2)),"Valid replacement failed to resume the daily interval");
}
finally
{
    SqliteConnection.ClearAllPools();
    damagedBackupRoot.Delete(recursive:true);
}
Console.WriteLine($"PASS: {assertions} .NET backend and backup assertions");

sealed class TestEnvironment:IHostEnvironment {
    public string EnvironmentName {get;set;}="Production";
    public string ApplicationName {get;set;}="SecurityChecks";
    public string ContentRootPath {get;set;}=Directory.GetCurrentDirectory();
    public IFileProvider ContentRootFileProvider {get;set;}=new NullFileProvider();
}
sealed class StaticHandler(int status,string body):HttpMessageHandler {
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken cancellation)=>Task.FromResult(new HttpResponseMessage((HttpStatusCode)status){Content=new StringContent(body,Encoding.UTF8,"application/json")});
}
