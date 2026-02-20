class Calculator {
public:
    int value;

    Calculator(int initial) : value(initial) {}

    int add(int n) {
        value += n;
        return value;
    }
};

struct Point {
    double x;
    double y;
};
