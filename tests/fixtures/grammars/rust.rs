struct Calculator {
    value: i64,
}

fn new_calculator(initial: i64) -> Calculator {
    Calculator { value: initial }
}

fn add(calc: &mut Calculator, n: i64) {
    calc.value += n;
}
