// Example programs.

export interface BreezeExample {
  id: string;
  title: string;
  description: string;
  code: string;
}

export const EXAMPLES: BreezeExample[] = [
  {
    id: "hello",
    title: "Hello, World",
    description: "The simplest Breeze program.",
    code: `# Welcome to Breeze — the easiest language!
show "Hello, World!"
show "Let's learn Breeze together."`,
  },
  {
    id: "variables",
    title: "Variables & Math",
    description: "Storing values and doing math.",
    code: `# Variables are simple — just use a name
name = "Alice"
age = 25
height = 5.6

# Show them
show "Name:", name
show "Age:", age
show "Height:", height

# Math just works
total = 10 + 20
show "10 + 20 =", total

# Text and numbers mix automatically
show "Next year I will be " + (age + 1)`,
  },
  {
    id: "conditions",
    title: "Conditions",
    description: "Making decisions with if and else.",
    code: `# Conditions with if / else
score = 85

if score >= 90:
  show "Grade: A"
else:
  if score >= 80:
    show "Grade: B"
  else:
    if score >= 70:
      show "Grade: C"
    else:
      show "Grade: F"

# Simple check
temperature = 30
if temperature > 25:
  show "It's hot outside!"
else:
  show "Nice weather."`,
  },
  {
    id: "loops",
    title: "Loops",
    description: "Repeating actions with repeat and for.",
    code: `# Repeat something N times
show "Counting up:"
repeat 5:
  show "Hello!"

# Loop with a counter variable
show "Numbers 1 to 5:"
repeat i from 1 to 5:
  show i

# Loop over a list
fruits = ["apple", "banana", "cherry"]
show "My fruits:"
for fruit in fruits:
  show "- " + fruit`,
  },
  {
    id: "functions",
    title: "Functions",
    description: "Reusable blocks of code.",
    code: `# Define a function
func greet(name):
  show "Hello, " + name + "!"

# Call it
greet("World")
greet("Breeze")

# Function that returns a value
func add(a, b):
  return a + b

result = add(10, 20)
show "10 + 20 =", result

# Function with logic
func isEven(n):
  if n % 2 == 0:
    return true
  else:
    return false

show "Is 4 even?", isEven(4)
show "Is 7 even?", isEven(7)`,
  },
  {
    id: "lists",
    title: "Lists",
    description: "Working with collections of values.",
    code: `# Make a list
numbers = [10, 20, 30, 40, 50]

# Access items
show "First:", numbers[0]
show "Third:", numbers[2]

# Change an item
numbers[0] = 99
show "Updated:", numbers

# Built-in helpers
show "Length:", len(numbers)
show "Sum:", sum(numbers)
show "Min:", min(numbers[0], numbers[1], numbers[2], numbers[3], numbers[4])
show "Max:", max(numbers[0], numbers[1], numbers[2], numbers[3], numbers[4])

# Add an item
push(numbers, 60)
show "After push:", numbers

# Loop over list
total = 0
for n in numbers:
  total = total + n
show "Total of all:", total`,
  },
  {
    id: "fizzbuzz",
    title: "FizzBuzz",
    description: "The classic interview question, made simple.",
    code: `# FizzBuzz in Breeze — so easy!
repeat i from 1 to 20:
  if i % 15 == 0:
    show "FizzBuzz"
  else:
    if i % 3 == 0:
      show "Fizz"
    else:
      if i % 5 == 0:
        show "Buzz"
      else:
        show i`,
  },
  {
    id: "strings",
    title: "Text Tricks",
    description: "Working with strings and text.",
    code: `# Text operations
greeting = "Hello, Breeze!"

show "Original:", greeting
show "Length:", len(greeting)
show "Uppercase:", upper(greeting)
show "Lowercase:", lower(greeting)

# Join words
words = ["Breeze", "is", "easy"]
sentence = join(words, " ")
show "Joined:", sentence

# Build text
name = "Sam"
age = 30
message = "My name is " + name + " and I am " + age + " years old."
show message`,
  },
  {
    id: "http-server",
    title: "HTTP Server",
    description: "Run a web server in Breeze on Node.",
    code: `# Start an HTTP server on port 3000
http.listen(3000, func(req):
  method = json.get(req, "method")
  path = json.get(req, "path")
  show method + " " + path

  if path == "/":
    return "Hello from Breeze!"
  if path == "/json":
    return json.stringify([["ok", true], ["time", time.now()]])
  return [
    ["status", 404],
    ["body", "Not found"]
  ]
)`,
  },
  {
    id: "interpolation",
    title: "String Interpolation",
    description: "Embed expressions directly in text with { }.",
    code: `# String interpolation — embed expressions inside { } in double quotes
name = "Alice"
age = 30
score = 95.5

show "Hello {name}!"
show "You are {age} years old."
show "Next year you will be {age + 1}."
show "Your score is {score} out of 100."

# Expressions work too
items = ["apple", "banana", "cherry"]
show "You have {len(items)} fruits."
show "First is {items[0]}."

# Use single quotes for literal text with curly braces
show '{this is literal, not a variable}'

# Or escape braces with backslash in double-quoted strings
show "Use \\{name\\} to insert a name."`,
  },
  {
    id: "while-elif",
    title: "While & Elif",
    description: "while loops and elif chains for cleaner logic.",
    code: `# while loop — repeat while a condition is true
show "Countdown:"
n = 5
while n > 0:
  show n
  n = n - 1
show "Liftoff!"

# elif — clean multi-branch conditionals (no nested if/else!)
func grade(score):
  if score >= 90:
    return "A"
  elif score >= 80:
    return "B"
  elif score >= 70:
    return "C"
  elif score >= 60:
    return "D"
  else:
    return "F"

show "Grade for 95:", grade(95)
show "Grade for 72:", grade(72)
show "Grade for 45:", grade(45)`,
  },
  {
    id: "break-continue",
    title: "Break & Continue",
    description: "Control loops with break and continue.",
    code: `# break — exit a loop early
show "Find first number > 50 divisible by 7:"
repeat i from 51 to 1000:
  if i % 7 == 0:
    show "Found: {i}"
    break

# continue — skip to the next iteration
show ""
show "Even numbers only:"
repeat i from 1 to 10:
  if i % 2 != 0:
    continue
  show i

# break out of a for loop
show ""
show "Stop at 'stop':"
words = ["go", "go", "go", "stop", "go"]
for word in words:
  if word == "stop":
    show "Stopping!"
    break
  show "Processing: {word}"`,
  },
  {
    id: "text-methods",
    title: "Text Methods",
    description: "Split, trim, replace, slice, and more.",
    code: `# Breeze has a rich set of text (string) functions
sentence = "  The quick brown fox  "

# trim — remove leading/trailing whitespace
clean = trim(sentence)
show "Trimmed: '{clean}'"

# split — break text into a list
words = split(clean, " ")
show "Words:", words
show "Word count:", len(words)

# contains — check if text includes something
show "Has 'fox'?", contains(clean, "fox")
show "Has 'cat'?", contains(clean, "cat")

# replace — swap text
show replace(clean, "fox", "cat")

# slice — get a substring
show slice(clean, 0, 3)
show slice(clean, 4, 9)

# starts_with / ends_with
show starts_with(clean, "The")
show ends_with(clean, "fox")

# index_of — find position
show "Position of 'brown':", index_of(clean, "brown")

# reverse — flip text
show reverse("Hello")

# upper / lower
show upper("hello")
show lower("WORLD")

# repeat_text — repeat a string
show repeat_text("-", 20)`,
  },
];
