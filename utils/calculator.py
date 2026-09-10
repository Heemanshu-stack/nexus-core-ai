import math

def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

def multiply(a, b):
    return a * b

def divide(a, b):
    if b == 0:
        raise ZeroDivisionError('Cannot divide by zero')
    return a / b

def power(a, b):
    return a ** b

def square_root(a):
    if a < 0:
        raise ValueError('Cannot calculate square root of negative number')
    return math.sqrt(a)

def factorial(n):
    if n < 0:
        raise ValueError('Cannot calculate factorial of negative number')
    elif n == 0 or n == 1:
        return 1
    else:
        return math.factorial(n)

def percentage(a, b):
    if b == 0:
        raise ValueError('Cannot calculate percentage with zero divisor')
    return (a / b) * 100

def modulus(a, b):
    if b == 0:
        raise ValueError('Cannot calculate modulus with zero divisor')
    return a % b