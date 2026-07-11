# CLI Tool in Breeze

A small command-line report generator written in
[Breeze](../..). It iterates over a list of sales rows, computes a subtotal
and running total per row, and prints a formatted report to the console.

## Run it

```bash
breeze run main.bz
```

## Example output

```
=== Sales Report ===

Product      Qty    Price    Subtotal
------------------------------------
Apples        10     0.5     5
Bananas       25     0.3     7.5
Cherries      8     3     24
Dates         15     2.5     37.5
------------------------------------
Total revenue: $74

Top seller: Bananas (by quantity)
Most expensive: Cherries
```

(Your numbers' formatting may vary slightly depending on how Breeze
renders floats — the math is the same.)

## What it demonstrates

- **Lists of lists** — each row in `sales` is itself a list, accessed with
  `row[0]`, `row[1]`, `row[2]` and `sales[1][0]` (nested indexing).
- **`for` loops** with an accumulator (`total_revenue = total_revenue + subtotal`).
- **`repeat i from X to Y`** — used here to right-pad the product name to a
  fixed width for column alignment.
- **String interpolation** — `"{name}{qty}     {price}     {subtotal}"`
  substitutes the variables directly into the output string.
- **Arithmetic** — `*` for multiplication, `+` for string concatenation.

## Tinker

- Replace the inline `sales` list with `fs.read("sales.csv")` parsed by
  `split(line, ",")` to load real data.
- Add a `most_popular` calculation that walks the list tracking the row
  with the largest `qty`.
- Use `html.ul([...])` to also emit the report as an HTML bullet list.
