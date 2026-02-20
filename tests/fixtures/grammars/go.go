package main

type Calculator struct {
	value int
}

func NewCalculator(initial int) *Calculator {
	return &Calculator{value: initial}
}

func (c *Calculator) Add(n int) {
	c.value += n
}
