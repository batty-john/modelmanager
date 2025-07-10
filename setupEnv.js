const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const questions = [
  { key: 'DB_NAME', question: 'Enter your MySQL database name: ' },
  { key: 'DB_USER', question: 'Enter your MySQL username: ' },
  { key: 'DB_PASSWORD', question: 'Enter your MySQL password: ' },
  { key: 'DB_HOST', question: 'Enter your MySQL host (default: localhost): ', default: 'localhost' },
  { key: 'PORT', question: 'Enter the app port (default: 3000): ', default: '3000' }
];

let envVars = {};
let i = 0;

function askNext() {
  if (i < questions.length) {
    const q = questions[i];
    rl.question(q.question, (answer) => {
      envVars[q.key] = answer || q.default || '';
      i++;
      askNext();
    });
  } else {
    const envContent = Object.entries(envVars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    fs.writeFileSync('.env', envContent);
    console.log('.env file created!');
    rl.close();
  }
}

askNext(); 