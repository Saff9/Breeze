# Breeze Browser Runtime

**Run Breeze in any HTML page.**

Drop one `<script>` tag into your HTML and write Breeze directly in the browser —
no build step, no bundler, no dependencies.

## Quick start

```html
<!DOCTYPE html>
<html>
<body>
  <div id="out"></div>

  <script src="breeze.js"></script>
  <script type="text/breeze" data-output="out">
    name = "World"
    show "Hello, {name}!"

    repeat i from 1 to 5:
      show "Count: {i}"
  </script>
</body>
</html>
```

Open the file in a browser. That's it.

## Install

Download [`breeze.js`](breeze.js) and include it in your HTML:

```html
<script src="breeze.js"></script>
```

Or via CDN (coming soon):

```html
<script src="https://cdn.jsdelivr.net/npm/breeze-lang@1/browser/breeze.js"></script>
```

## How it works

1. Include `breeze.js` on your page.
2. Write Breeze code in a `<script type="text/breeze">` tag.
3. The runtime auto-runs all Breeze script tags on `DOMContentLoaded`.
4. `show` output goes to a `data-output` element (or the browser console).

### Routing output

Add a `data-output` attribute pointing to an element ID:

```html
<div id="results"></div>
<script type="text/breeze" data-output="results">
  show "This appears in the #results div"
</script>
```

Without `data-output`, output goes to `console.log` with a `[breeze]` prefix.

## JavaScript API

You can also run Breeze from JavaScript:

```javascript
// Run code, collect output
const result = Breeze.run('show 1 + 2  show "hi"');
console.log(result.output);  // ["3", "hi"]

// Run code, pipe output to a DOM element
Breeze.run('repeat i from 1 to 3: show i', "output-div-id");
```

### `Breeze.run(source, outputTarget?)`

- `source` — Breeze source code (string)
- `outputTarget` — optional: an element ID (string) or DOM element. When
  provided, `show` output is appended to that element as text nodes.
- Returns `{ output: string[], error: string | null, errorLine: number | null, errorFormatted: string | null }`

## Standard library

The browser runtime includes these modules (no Node.js APIs):

| Module | Functions |
|--------|-----------|
| `json` | `parse`, `stringify`, `get`, `has`, `keys` |
| `math` | `pi`, `e`, `tau`, `sqrt`, `pow`, `sin`, `cos`, `tan`, `log`, `exp` |
| `time` | `now`, `seconds` |
| `html` | `escape`, `tag`, `page`, `div`, `p`, `h1`, `link` |
| `dom` | `set`, `text`, `get`, `append`, `value`, `set_value`, `hide`, `show` |

Plus all core builtins: `len`, `text`, `number`, `upper`, `lower`, `abs`,
`round`, `floor`, `ceil`, `random`, `sum`, `min`, `max`, `push`, `range`,
`type`, `join`, `split`, `contains`, `trim`, `replace`, `slice`,
`starts_with`, `ends_with`, `index_of`, `reverse`, `repeat_text`.

### Building HTML

Use the `html` module to generate HTML strings, then inject them with `dom`:

```breeze
# Build a list of items
items = ["Apples", "Bananas", "Cherries"]

list_html = ""
for item in items:
  list_html = list_html + html.tag("li", item)

dom.set("list", html.tag("ul", list_html))
```

### Reading input

```breeze
name = dom.value("name-input")
dom.text("greeting", "Hello, {name}!")
```

## Examples

See the [`examples/`](examples) folder:

- [`hello.html`](examples/hello.html) — basic "Hello, World" with Fibonacci
- [`table.html`](examples/table.html) — generates and injects an HTML multiplication table

## Language features

- Variables, numbers, text, booleans, lists, `none`
- `show`, `if`/`elif`/`else`, `while`, `repeat`, `repeat..from..to`, `for`
- `func`, `return`, `break`, `continue`
- String interpolation: `"Hello {name}!"`
- Operators: `+ - * / % == != < > <= >= and or not`
- Auto text-join: `"Age: " + 25` → `"Age: 25"`
- Comments: `# ...`

## License

MIT
