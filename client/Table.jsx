import React from 'react'

function Table({headers, rows}) {
    return <table><THead headers={headers} /><TBody rows={rows} /></table>
}

function THead({headers}) {
    const ths = headers.map((label, i) => <th key={i}>{label}</th>)
    return <thead><tr>{ths}</tr></thead>
}

function TBody({rows}) {
    const trs = rows.map((values, i) => <Row key={i} values={values} />)
    return <tbody>{trs}</tbody>
}

function Row({values}) {
    const tds = values.map((value, i) => <td key={i}>{value}</td>)
    return <tr>{tds}</tr>
}

export default Table
