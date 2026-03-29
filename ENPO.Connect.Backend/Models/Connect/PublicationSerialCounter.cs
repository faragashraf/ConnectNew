namespace Models.Correspondance;

public partial class PublicationSerialCounter
{
    public int CounterYear { get; set; }
    public int LastSerial { get; set; }
    public byte[] RowVersion { get; set; } = System.Array.Empty<byte>();
}
