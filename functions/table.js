const Table = {
  name: 'Table',
  genericParams: ['ArgType', 'SortType'],
  args: [
    {
      name: 'keys',
      type: 'Array<$ArgType>',
    },
    {
      name: 'columns',
      type: 'Array<Column>($ArgType)',
      lazy: true,
    },
    {
      name: 'sort',
      type: '$SortType($ArgType)',
      lazy: true,
    },
  ],
  outputType: 'Table',
  usesGenericTypes: true,
  implementation: (generics, keys, columns, sort) => {
    var rows = keys.sort((rowA, rowB) => {
      return sort({[generics.ArgType]: rowA}) < sort({[generics.ArgType]: rowB}) ? -1 : 1
    }).map((val) => {
      return columns({[generics.ArgType]: val})
    })
    return {
      headers: rows.length ? rows[0].map((col) => col.title) : 0,
      rows: rows
    }
  },
}

const Column = {
  name: 'Column',
  genericParams: ['T'],
  args: [
    {
      name: 'title',
      type: 'String',
    },
    {
      name: 'value',
      type: '$T',
    },
    {
      name: 'link',
      type: 'String',
      defaultValue: '',
    },
  ],
  outputType: 'Column',
  implementation: (title, value, link) => {
    return {title: title, value: value, link: link}
  },
}

module.exports = {
  functions: [Table, Column],
}
