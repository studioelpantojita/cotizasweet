using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;
public class QuoteStore
{
    readonly string path;
    SqliteConnection Open() { var db=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=path,DefaultTimeout=5}.ToString());db.Open();return db; }
    public QuoteStore(string database) {
        path=Path.GetFullPath(database);Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        using var db=Open();using var cmd=db.CreateCommand();
        cmd.CommandText="PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS quotes_owner ON quotes(owner,created_at DESC);";cmd.ExecuteNonQuery();
        if(!OperatingSystem.IsWindows())File.SetUnixFileMode(path,UnixFileMode.UserRead|UnixFileMode.UserWrite);
    }
    public List<object> List(string owner) {
        using var db=Open();using var cmd=db.CreateCommand();cmd.CommandText="SELECT id,payload,total_cents,created_at FROM quotes WHERE owner=$owner ORDER BY created_at DESC,id DESC LIMIT 200";cmd.Parameters.AddWithValue("$owner",owner);
        using var rows=cmd.ExecuteReader();var result=new List<object>();
        while(rows.Read())result.Add(new{id=rows.GetString(0),quote=JsonNode.Parse(rows.GetString(1)),totalCents=rows.GetInt64(2),createdAt=rows.GetString(3)});
        return result;
    }
    public object Save(string owner,JsonObject q) {
        var id=Guid.NewGuid().ToString();var totalCents=QuoteDomain.Totals(q)["total"];var createdAt=DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'");
        using var db=Open();using var cmd=db.CreateCommand();cmd.CommandText="INSERT INTO quotes VALUES ($id,$owner,$payload,$total,$created)";
        cmd.Parameters.AddWithValue("$id",id);cmd.Parameters.AddWithValue("$owner",owner);cmd.Parameters.AddWithValue("$payload",q.ToJsonString());cmd.Parameters.AddWithValue("$total",totalCents);cmd.Parameters.AddWithValue("$created",createdAt);cmd.ExecuteNonQuery();
        return new{id,quote=q,totalCents,createdAt};
    }
}
