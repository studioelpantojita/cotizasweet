using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using Json.Schema;
using Microsoft.Data.Sqlite;

public sealed class CatalogStore
{
    readonly string path;
    static readonly JsonSchema Schema=JsonSchema.FromText(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"contracts","catalog.schema.json")));
    public CatalogStore(IConfiguration config) {
        path=Path.GetFullPath(config["DATABASE_PATH"]??"./data/dotnet.sqlite");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var file=config["CATALOG_FILE"]??Path.Combine(AppContext.BaseDirectory,"contracts","catalog.json");
        var raw=File.ReadAllText(file);
        var data=Validate(raw);
        using var db=Open();
        using var cmd=db.CreateCommand();
        cmd.CommandText="CREATE TABLE IF NOT EXISTS catalog_snapshot (id INTEGER PRIMARY KEY CHECK(id=1), content_hash TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), imported_at TEXT NOT NULL)";
        cmd.ExecuteNonQuery();
        cmd.CommandText="INSERT INTO catalog_snapshot VALUES (1,$hash,$payload,$date) ON CONFLICT(id) DO UPDATE SET content_hash=excluded.content_hash,payload=excluded.payload,imported_at=excluded.imported_at WHERE content_hash<>excluded.content_hash";
        cmd.Parameters.AddWithValue("$hash",Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(raw))).ToLowerInvariant());
        cmd.Parameters.AddWithValue("$payload",data.ToJsonString());
        cmd.Parameters.AddWithValue("$date",DateTime.UtcNow.ToString("O"));
        cmd.ExecuteNonQuery();
    }
    SqliteConnection Open(){var db=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=path,DefaultTimeout=5}.ToString());db.Open();return db;}
    static JsonObject Validate(string raw){
        if(System.Text.Encoding.UTF8.GetByteCount(raw)>300000)throw new InvalidOperationException("Catálogo demasiado grande.");
        var data=JsonNode.Parse(raw)!.AsObject();
        if(!Schema.Evaluate(JsonDocument.Parse(raw).RootElement).IsValid)throw new InvalidOperationException("Catálogo inválido.");
        var ids=new HashSet<string>();
        foreach(var p in data["products"]!.AsArray()){
            if(!ids.Add(p!["id"]!.GetValue<string>()))throw new InvalidOperationException("Producto duplicado.");
            var variants=new HashSet<string>();
            foreach(var v in p["variants"]!.AsArray())
                if(!variants.Add(v!["id"]!.GetValue<string>())||v["prices"]!.AsObject().Count==0)throw new InvalidOperationException("Variante inválida.");
            var c=p["confirmation"]!;
            if(c["status"]!.GetValue<string>()=="confirmed"){
                var start=c["date"]!.GetValue<string>();var end=c["validUntil"]!.GetValue<string>();
                if(!DateOnly.TryParseExact(start,"yyyy-MM-dd",out var a)||!DateOnly.TryParseExact(end,"yyyy-MM-dd",out var b)||a>b)throw new InvalidOperationException("Confirmación inválida.");
            }
        }
        return data;
    }
    public JsonObject Read(){
        using var db=Open();using var cmd=db.CreateCommand();
        cmd.CommandText="SELECT payload FROM catalog_snapshot WHERE id=1";
        var data=Validate((string)cmd.ExecuteScalar()!);
        data["products"]=new JsonArray(data["products"]!.AsArray().Where(p=>p!["published"]!.GetValue<bool>()).Select(p=>p!.DeepClone()).ToArray());
        return data;
    }
}
