using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.Json;
using System.Text.RegularExpressions;
using Json.Schema;

public static class QuoteDomain
{
    static readonly string Root = Path.Combine(AppContext.BaseDirectory,"contracts");
    static readonly JsonNode Raw = JsonNode.Parse(File.ReadAllText(Path.Combine(Root,"quote.schema.json")))!;
    static readonly JsonSchema Schema = JsonSchema.FromText(Raw.ToJsonString());
    static readonly JsonArray Ingredients = JsonNode.Parse(File.ReadAllText(Path.Combine(Root,"ingredients.json")))!.AsArray();
    static readonly JsonNode Ubigeo = JsonNode.Parse(File.ReadAllText(Path.Combine(Root,"ubigeo.json")))!;
    public static string S(JsonNode q,string field) => q[field]?.GetValue<string>() ?? "";
    public static long N(JsonNode q,string field) => (long)q[field]!.GetValue<decimal>();
    static bool B(JsonNode q,string field) => q[field]?.GetValue<bool>() ?? false;
    static void Require(bool condition,string message) { if(!condition) throw new ArgumentException(message); }
    static void Defaults(JsonNode? value,JsonNode schema)
    {
        if(schema["$ref"] is JsonValue reference) {
            JsonNode target=Raw;
            foreach(var piece in reference.GetValue<string>()[2..].Split('/')) target=target[piece]!;
            Defaults(value,target);return;
        }
        if(value is JsonObject obj && schema["properties"] is JsonObject properties)
            foreach(var property in properties) {
                if(!obj.ContainsKey(property.Key) && property.Value!.AsObject().ContainsKey("default")) obj[property.Key]=property.Value["default"]?.DeepClone();
                if(obj.ContainsKey(property.Key)) Defaults(obj[property.Key],property.Value!);
            }
        if(value is JsonArray array && schema["items"] is JsonObject items)
            foreach(var item in array) Defaults(item,items);
        if(value is JsonObject record && schema["additionalProperties"] is JsonObject additional)
            foreach(var property in record) Defaults(property.Value,additional);
    }
    public static bool ValidRuc(string ruc) {
        if(!Regex.IsMatch(ruc,@"^(10|15|16|17|20)[0-9]{9}$"))return false;
        int[] weights=[5,4,3,2,7,6,5,4,3,2];
        return (11-weights.Select((w,i)=>w*(ruc[i]-'0')).Sum()%11)%10==ruc[10]-'0';
    }
    public static string DocumentType(JsonNode q) => S(q,"documentType") is "ruc" or "dni" ? S(q,"documentType") : (S(q,"clientType")=="empresa" || S(q,"clientDocument").Length==11?"ruc":"dni");
    static JsonNode? Normalize(JsonNode? node) {
        if(node is JsonValue value && value.TryGetValue<string>(out var text)) return JsonValue.Create(text.Trim());
        if(node is JsonObject obj) return new JsonObject(obj.Select(kv=>new KeyValuePair<string,JsonNode?>(kv.Key,Normalize(kv.Value))));
        if(node is JsonArray array) return new JsonArray(array.Select(Normalize).ToArray());
        return node?.DeepClone();
    }
    public static JsonObject Validate(JsonNode? value,bool creating=false)
    {
        Require(value is JsonObject,"Se requiere un objeto JSON.");
        var q=Normalize(value)!.AsObject();
        if(creating)Require(q["formVersion"]?.ToJsonString()=="2" && q["pricingVersion"]?.ToJsonString()=="2","Las nuevas cotizaciones requieren versión 2.");
        Defaults(q,Raw);
        Require(Schema.Evaluate(JsonSerializer.SerializeToElement(q),new EvaluationOptions {OutputFormat=OutputFormat.Flag}).IsValid,"Formato de cotización inválido.");
        foreach(var name in new[]{"client","contact","event","clientEmail"}) q[name]=S(q,name).Trim();
        Require(S(q,"client").Length>0,"Nombre del cliente requerido.");
        if(N(q,"formVersion")==2) {
            var kind=DocumentType(q);
            Require((S(q,"clientType")!="empresa" || kind=="ruc") && (kind=="ruc"?ValidRuc(S(q,"clientDocument")):Regex.IsMatch(S(q,"clientDocument"),"^[0-9]{8}$")),"Documento inválido.");
            Require(S(q,"contact").Length>0 && S(q,"event").Length>0,"Contacto y proyecto requeridos.");
        }
        Require(S(q,"clientEmail")=="" || Regex.IsMatch(S(q,"clientEmail"),@"^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$"),"Correo inválido.");
        DateOnly Parse(string s) => DateOnly.ParseExact(s,"yyyy-MM-dd",CultureInfo.InvariantCulture);
        var issued=Parse(S(q,"issued"));var valid=Parse(S(q,"validUntil"));
        Require(valid>=issued && (S(q,"eventDate")=="" || Parse(S(q,"eventDate"))>=issued),"Fechas inválidas.");
        if(N(q,"pricingVersion")==2) Require(N(q,"taxPercent")==18 && valid<=issued.AddDays(21) && S(q,"locationMode")!="legacy" && N(q,"deliveryCents")==0,"Revisa vigencia, movilidad e IGV.");
        var province=Ubigeo["provinces"]!.AsArray().FirstOrDefault(x=>S(x!,"id")==S(q,"provinceId"));
        var district=Ubigeo["districts"]!.AsArray().FirstOrDefault(x=>S(x!,"id")==S(q,"districtId"));
        Require((S(q,"provinceId")=="" || province!=null) && (S(q,"districtId")=="" || (district!=null && S(district,"provinceId")==S(q,"provinceId"))) && (S(q,"locationMode")!="on_location" || (province!=null && district!=null)),"Ubicación inválida.");
        if(creating && S(q,"locationMode")=="on_location") Require(S(q,"address").Length>0,"Indica la dirección o referencia para entregar el pedido en locación.");
        if(creating) Require(Regex.IsMatch(S(q,"contact"),@"^(?:\+51 ?)?[0-9]{9}$"),"Ingresa un teléfono de 9 dígitos, sin incluir el código +51.");
        foreach(var material in q["materials"]!.AsArray()) {
            var m=material!;var definition=Ingredients.FirstOrDefault(d=>S(d!,"name")==S(m,"name"));
            var selections=m["configuration"]!["selections"]!.AsObject();
            foreach(var selection in selections) {
                var group=definition?["groups"]?.AsArray().FirstOrDefault(g=>S(g!,"id")==selection.Key);
                var values=selection.Value!.AsArray().Select(v=>v!.GetValue<string>()).ToArray();
                Require(group!=null && values.Distinct().Count()==values.Length && values.All(v=>group["options"]!.AsArray().Any(o=>o!.GetValue<string>()==v)),"Insumos inválidos.");
            }
            var sweet=selections["sweetener"]?.AsArray();
            Require(sweet==null || !sweet.Any(s=>s!.GetValue<string>()=="Sin endulzante añadido") || sweet.Count==1,"Endulzantes incompatibles.");
            Require(!B(m,"confirmed") || S(m,"detail").Trim().Length>0,"Especificación histórica requerida.");
        }
        Require(!B(q,"allergenReviewed") || S(q,"allergenNotes").Trim().Length>0,"Revisión histórica requerida.");
        return q;
    }
    static long Percent(long value,long rate)=>(value*rate+50)/100;
    public static Dictionary<string,long> Totals(JsonNode q) {
        long packs=0,addons=0;
        foreach(var i in q["items"]!.AsArray()) {var line=N(i!,"priceCents")*N(i!,"quantity");if(S(i!,"category")=="addon")addons+=line;else packs+=line;}
        var subtotal=packs+addons;var rate=N(q,"pricingVersion")==2 && S(q,"locationMode")=="on_location"?5:0;
        var mobility=N(q,"pricingVersion")==2?Percent(subtotal,rate):N(q,"deliveryCents");
        var basis=subtotal+mobility;var tax=N(q,"pricingVersion")==2?Percent(basis,18):0;var total=basis+tax;var advance=Percent(total,N(q,"advancePercent"));
        return new(){{"subtotal",subtotal},{"total",total},{"advance",advance},{"balance",total-advance},{"packs",packs},{"addons",addons},{"mobility",mobility},{"mobilityRate",rate},{"base",basis},{"tax",tax}};
    }
}
