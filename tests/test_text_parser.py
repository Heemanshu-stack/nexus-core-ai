import pytest
from utils.text_parser import count_words

def test_count_words():
    assert count_words('Hello World') == 2
    assert count_words('This is a test') == 4
    assert count_words('') == 0