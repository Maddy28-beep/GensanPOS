namespace GenSteelPOS.Domain.Enums;

public enum StockMovementType
{
    StockIn = 1,
    StockAdjustment = 2,
    Sale = 3,
    Refund = 4,
    Cancellation = 5,
    Void = 6,
    Return = 7,
    DamagedReturn = 8
}
