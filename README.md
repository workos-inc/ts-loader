# TypeScript loader for webpack

A fork of TypeStrong's [ts-loader](https://github.com/TypeStrong/ts-loader).

Additional feature `emitOnly` which lets you compile typescript while only emiting definitions for a discrete set of files.

## Usage:

```ts
 module: {
    rules: [
      {
        loader: '@maxchehab/ts-loader',
        options: {
          emitOnly: [/\.entity.*/],
        },
      },
    ],
  },
```

## Benchmarks:
Yet to benchmark, but expect similar performance benefits of the `transpileOnly` flag.

### Without `emitOnly`

```bash
Hash: bc3eade0c1913aa45074
Version: webpack 4.43.0
Time: 82346ms
Built at: 05/02/2020 11:48:58 PM
```

### With `emitOnly`

```bash
Hash: 6637ee52048fc3864106
Version: webpack 4.43.0
Time: 8095ms
Built at: 05/02/2020 11:45:33 PM
```

## License

MIT License
