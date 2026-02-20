public class Calculator
{
    private int _value;

    public Calculator(int initial)
    {
        _value = initial;
    }

    public int Add(int n)
    {
        _value += n;
        return _value;
    }
}
