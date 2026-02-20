public class Calculator {
    private int value;

    public Calculator(int initial) {
        this.value = initial;
    }

    public int add(int n) {
        this.value += n;
        return this.value;
    }
}
