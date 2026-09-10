import unittest
from utils.calculator import square_root, factorial, percentage, modulus

class TestCalculator(unittest.TestCase):
    def test_square_root(self):
        self.assertAlmostEqual(square_root(4), 2)
        self.assertAlmostEqual(square_root(0), 0)
        with self.assertRaises(ValueError):
            square_root(-1)

    def test_factorial(self):
        self.assertEqual(factorial(0), 1)
        self.assertEqual(factorial(1), 1)
        self.assertEqual(factorial(5), 120)
        with self.assertRaises(ValueError):
            factorial(-1)

    def test_percentage(self):
        self.assertAlmostEqual(percentage(10, 20), 50)
        with self.assertRaises(ValueError):
            percentage(10, 0)

    def test_modulus(self):
        self.assertEqual(modulus(10, 3), 1)
        with self.assertRaises(ValueError):
            modulus(10, 0)

if __name__ == '__main__':
    unittest.main()