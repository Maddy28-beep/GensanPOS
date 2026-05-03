namespace GenSteelPOS.Application.Common.Exceptions;

public class AppException : Exception
{
    public AppException(string message, int statusCode = 400) : base(message)
    {
        StatusCode = statusCode;
    }

    public int StatusCode { get; }
}
