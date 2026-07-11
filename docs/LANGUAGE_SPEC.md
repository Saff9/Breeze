# Breeze Language Specification

**Version 1.2** — July 2026

This is the specification for the Breeze programming language. It defines syntax, types, standard built-ins, and execution behavior.

---

## 1. Overview

Breeze is a dynamically-typed, indentation-based scripting language. Its core goals are:

1. **Readability:** Code should read like simple English.
2. **Low syntax overhead:** No semicolons, no curly braces.
3. **No magic type coercion:** Except for the `+` operator, which converts operands to text when joining them.
4. **Execution safety:** A configurable sandbox mode disables disk write/read and system call permissions.

Breeze uses a simple tree-walking interpreter. It prioritizes ease of use and learning over raw performance.

---

## 2. Lexical Structure

### Character Encoding
Source files must be UTF-8. Identifiers start with a letter (`a-z`, `A-Z`) or an underscore `_`, followed by alphanumeric characters or underscores.

### Whitespace & Indentation
* Spaces and tabs separate tokens.
* **Tabs are normalized to two spaces** prior to parsing.
* Blocks are defined by indentation level. The depth of leading spaces must be consistent within a block.
* Blank lines and lines starting with `#` (comments) are ignored and do not affect indentation.

### Comments
A `#` character starts a comment that runs to the end of the line.

```breeze
show "hello" # this is a comment
```

### Indentation Tokens
The lexer tracks indentation levels on a stack and generates three synthetic tokens:
* `INDENT` — when indentation depth increases.
* `DEDENT` — when indentation depth decreases.
* `NEWLINE` — at the end of a non-empty statement line.

Inconsistent indentation levels trigger a syntax error:
`Error (line N): Inconsistent indentation — does not match any previous level`

### Literals

* **Number:** Integers (`42`) or decimals (`3.14`).
* **Text:** Double quotes (`"hello"`) or single quotes (`'hello'`). Double quotes support variable interpolation.
* **Boolean:** `true` or `false`.
* **None:** `none`.

Escape sequences: `\n`, `\t`, `\r`, `\\`, and quotes (`\"`, `\'`). Unescaped newlines inside string literals are invalid.

### Keywords
Reserved identifiers:
```
show  if  elif  else  while  repeat  from  to  for  in  func  return  break  continue  try  catch  true  false  none  and  or  not  import  export
```

### Operators & Punctuation
```
+  -  *  /  %        arithmetic
==  !=  <  >  <=  >= comparison
=                     assignment
(  )  [  ]  {  }  :  , punctuation
.                     member access
```

---

## 3. Statements

A program is a series of statements separated by newlines.

### `show`
```
show expr ("," expr)*
```
Converts each expression to text, prints them separated by a space, and appends a newline.

### Assignment
```
target "=" expr
```
`target` can be an identifier or an index expression (`list[index]`). Binds the value to the target in the current scope.

### `if` / `elif` / `else`
```breeze
if cond:
  block
elif cond:
  block
else:
  block
```
Evaluates conditions sequentially. Runs the block corresponding to the first truthy condition.

### Loops

#### `while`
```breeze
while cond:
  block
```
Runs the block repeatedly as long as `cond` is truthy.

#### `repeat` (simple count)
```breeze
repeat count:
  block
```
Runs the block `count` times. `count` must be a non-negative number.

#### `repeat ... from ... to ...` (range loop)
```breeze
repeat i from start to end:
  block
```
Binds `i` to each integer from `start` to `end` (inclusive) and executes the block.

#### `for ... in ...`
```breeze
for item in list:
  block
```
Iterates over elements of a list in order.

### Loop Control
* `break` exits the nearest enclosing loop immediately.
* `continue` skips to the next iteration of the loop.

### Functions (`func`)
```breeze
func name(param1, param2):
  block
```
Declares a named function. Functions are hoisted within their scope.
* `return expr` exits the function and yields `expr`'s value. 
* A bare `return` or falling off the end of a function yields `none`.

### Error Handling (`try` / `catch`)
```breeze
try:
  block
catch err_var:
  block
```
Catches runtime errors that occur during the execution of the `try` block. Binds the error message string to `err_var` in the `catch` block scope.

### Imports & Exports

```breeze
import { name1, name2 } from "./module.bz"
```
Loads and executes the referenced file and binds the exported variables in the current module.

```breeze
export func my_func():
  pass
```
Exposes functions or variables to modules importing this file.

---

## 4. Expressions

Operator precedence (lowest to highest):

1. `or`
2. `and`
3. `not` (unary)
4. `==`, `!=`, `<`, `>`, `<=`, `>=`
5. `+`, `-`
6. `*`, `/`, `%`
7. `-` (negation prefix)
8. Call `f(...)`, index `a[i]`, member access `a.b`

Parentheses `(...)` override precedence.

---

## 5. Types & Semantics

### Value Types
* **Number:** 64-bit float (`f64`). Integer values are printed without decimal points. Division `/` always returns a float.
* **Text:** Unicode string. `len(s)` returns the character count. Indexing `s[i]` returns a single-character string.
* **Boolean:** `true` or `false`.
* **None:** `none`.
* **List:** Mutable array of mixed types (e.g. `[1, "two", none]`).
* **Function:** A callable closure.

### Truthiness
The following are **falsy**: `none`, `false`, `0`, `""`, and `[]`. All other values are truthy.

### Polymorphic `+` Operator
* **number + number:** Adds numbers.
* **text + anything / anything + text:** Converts the non-text operand to string and joins them (e.g. `"age: " + 25` yields `"age: 25"`).
* **list + list:** Concatenates lists.

---

## 6. Standard Library & Globals

### Core Built-ins
* `text(x)` — converts any value to its string representation.
* `number(x)` — converts strings or booleans to floats.
* `len(x)` — returns character count of text or element count of a list.
* `upper(s)` / `lower(s)` — case conversion.
* `abs(x)` / `round(x)` / `floor(x)` / `ceil(x)` — math utilities.
* `random(a, b)` — random integer in `[a, b]` inclusive.
* `sum(list)` — returns the sum of numeric list elements.
* `min(a, ...)` / `max(a, ...)` — returns smallest/largest argument.
* `push(list, x)` — appends `x` and returns the mutated list.
* `range(n)` / `range(a, b)` — generates a list of integers.
* `type(x)` — returns type name string (`"number"`, `"text"`, `"boolean"`, `"none"`, `"list"`, `"function"`).
* `join(list, sep)` — joins list elements with a separator.
* `split(s, sep)` — splits a string into a list.
* `contains(x, item)` — checks if text contains substring, or if list contains item.
* `trim(s)` — trims whitespace.
* `replace(s, old, new)` — replaces substrings.
* `slice(s, start, end)` — returns a substring.
* `starts_with(s, prefix)` / `ends_with(s, suffix)` — boundary checks.
* `index_of(x, item)` — index of item in list or string (returns `-1` if not found).
* `reverse(x)` — reverses a string or list.

### Modules
* **`http`:** `listen(port, handler)`, `get(url, headers?)`, `post(url, body, headers?)`, `ok(body)`, `error(status, message)`
* **`json`:** `parse(s)`, `stringify(val)`, `get(obj, key)`, `set(obj, key, val)`, `keys(obj)`, `values(obj)`, `has(obj, key)`
* **`fs`:** `read(path)`, `write(path, data)`, `append(path, data)`, `exists(path)`, `list(path)`, `remove(path)`, `mkdir(path)`
* **`env`:** `get(name)`, `set(name, value)`, `list()`
* **`time`:** `now()`, `sleep(ms)`, `seconds()`
* **`math`:** Constants `pi`, `e`, `tau` and functions `sqrt`, `pow`, `sin`, `cos`, `tan`, `log`, `exp`
* **`html`:** HTML tag string generators (`escape`, `tag`, `page`, `div`, `p`, `h1`, `ul`, `ol`, `link`, etc.)

---

## 7. Execution Limits

To catch infinite loops, execution is capped at **10,000,000 operations**. Exceeding this limit throws:
`Error (line N): Program ran for too long — possible infinite loop`

Function recursion is guarded at a maximum depth of **200 frames**.
