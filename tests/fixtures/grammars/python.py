def greet(name):
    return "Hello, " + name


class Calculator:
    def __init__(self, initial):
        self.value = initial

    def add(self, n):
        self.value += n
        return self
