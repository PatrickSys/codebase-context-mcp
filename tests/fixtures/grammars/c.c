struct Calculator {
    int value;
};

void calculator_init(struct Calculator* calc, int initial) {
    calc->value = initial;
}

int calculator_add(struct Calculator* calc, int n) {
    calc->value += n;
    return calc->value;
}
