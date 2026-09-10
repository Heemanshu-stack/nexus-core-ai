let display = document.getElementById('display');
let currentNumber = '';
let previousNumber = '';
let operator = '';

function updateDisplay() {
    display.value = currentNumber;
}

function clearDisplay() {
    currentNumber = '';
    previousNumber = '';
    operator = '';
    updateDisplay();
}

function backspace() {
    currentNumber = currentNumber.slice(0, -1);
    updateDisplay();
}

function equals() {
    let result;
    switch (operator) {
        case '+':
            result = parseFloat(previousNumber) + parseFloat(currentNumber);
            break;
        case '-':
            result = parseFloat(previousNumber) - parseFloat(currentNumber);
            break;
        case '*':
            result = parseFloat(previousNumber) * parseFloat(currentNumber);
            break;
        case '/':
            result = parseFloat(previousNumber) / parseFloat(currentNumber);
            break;
        default:
            result = currentNumber;
    }
    currentNumber = result.toString();
    previousNumber = '';
    operator = '';
    updateDisplay();
}

function handleNumberClick(number) {
    currentNumber += number;
    updateDisplay();
}

function handleOperatorClick(op) {
    if (currentNumber !== '') {
        previousNumber = currentNumber;
        currentNumber = '';
        operator = op;
    }
}

document.getElementById('clear').addEventListener('click', clearDisplay);
document.getElementById('backspace').addEventListener('click', backspace);
document.getElementById('equals').addEventListener('click', equals);
document.getElementById('0').addEventListener('click', () => handleNumberClick('0'));
document.getElementById('1').addEventListener('click', () => handleNumberClick('1'));
document.getElementById('2').addEventListener('click', () => handleNumberClick('2'));
document.getElementById('3').addEventListener('click', () => handleNumberClick('3'));
document.getElementById('4').addEventListener('click', () => handleNumberClick('4'));
document.getElementById('5').addEventListener('click', () => handleNumberClick('5'));
document.getElementById('6').addEventListener('click', () => handleNumberClick('6'));
document.getElementById('7').addEventListener('click', () => handleNumberClick('7'));
document.getElementById('8').addEventListener('click', () => handleNumberClick('8'));
document.getElementById('9').addEventListener('click', () => handleNumberClick('9'));
document.getElementById('decimal').addEventListener('click', () => handleNumberClick('.'));
document.getElementById('add').addEventListener('click', () => handleOperatorClick('+'));
document.getElementById('subtract').addEventListener('click', () => handleOperatorClick('-'));
document.getElementById('multiply').addEventListener('click', () => handleOperatorClick('*'));
document.getElementById('divide').addEventListener('click', () => handleOperatorClick('/'));