import React, {useState, useEffect} from 'react'

import Table from './Table'

const fetch = window.fetch

function useEffectAsyncOnce(fn) {
    const [done, setDone] = useState(false)
    if (!done) {
        setDone(true)
        fn().catch(console.error)
        // could setDone(false) on error, but this could cause infinite retry
    }
}

function useFetchJsonOnce(url, fn) {
    useEffectAsyncOnce(async () => {
        const result = await fetch(url)
        return fn(await result.json())
    })
}

function Fieldset({id, legend: title, children}) {
    return <fieldset id={id}><legend>{title}</legend>{children}</fieldset>
}

function Checkbox({checked, name, label: text, onChange}) {
    const handleChange = event => {
        onChange(name, event.target.checked)
    }

    return (
        <span className="checkbox">
            <input type="checkbox" checked={checked} onChange={handleChange} />
            <label>{text}</label>
        </span>
    )
}

function ControlPanel({options, setOptions, collapse, setCollapse}) {
    const [config, setConfig] = useState({universes: [], series: []})
    const [includeManga, setIncludeManga] = useState(false)

    useFetchJsonOnce('/api/getConfig', setConfig)

    const collapseOnChange = (name, value) => setCollapse(value)
    const collapseBox = <Checkbox checked={collapse}
                                  name="collapse"
                                  label="Collapse Variants"
                                  onChange={collapseOnChange} />

    const mangaOnChange = (name, value) => {
        setIncludeManga(value)
        const newOptions = Object.assign({}, options)
        if (value) {
            // find enabled universes, ignoring manga
            const universes = {}
            config.universes.forEach(({id}) => universes[id] = true)
            config.series.filter(({manga}) => !manga)
                .forEach(({id, universe}) => universes[universe] &= options[id])
            // enable manga for enabled universes
            config.series.filter(({manga}) => manga)
                .forEach(({id, universe}) => newOptions[id] = universes[universe])
        }
        else {
            // disable all manga
            config.series.filter(({manga}) => manga)
                .forEach(({id}) => newOptions[id] = false)
        }
        setOptions(newOptions)
    }

    const mangaBox = <Checkbox checked={includeManga}
                               name="manga"
                               label="Include Manga"
                               onChange={mangaOnChange} />

    const series = config.series.filter(({manga}) => includeManga || !manga)

    // universe is enabled if all series are enabled
    const universes = {}
    config.universes.forEach(({id}) => universes[id] = true)
    series.forEach(({id, universe}) => universes[universe] &= options[id])

    const universeOnChange = (name, value) => {
        // set value to all series in universe
        const newOptions = Object.assign({}, options)
        series.filter(({universe}) => universe == name)
            .forEach(({id}) => newOptions[id] = value)
        setOptions(newOptions)
    }

    const universeBoxes = config.universes
        .map(({id, name}) => <Checkbox key={id}
                                       checked={universes[id] || false}
                                       name={id}
                                       label={name}
                                       onChange={universeOnChange}/> )

    const seriesOnChange = (name, value) => {
        setOptions(Object.assign({}, options, {[name]: value}))
    }

    const seriesBoxes = series
        .map(({id, name}) => <Checkbox key={id}
                                       checked={options[id] || false}
                                       name={id}
                                       label={name}
                                       onChange={seriesOnChange}/> )
    return (
        <div>
            <Fieldset id="filters" legend="Filters">
                {collapseBox}
                {mangaBox}
                <Fieldset id="universes" legend="Universes">{universeBoxes}</Fieldset>
                <Fieldset id="series" legend="Series">{seriesBoxes}</Fieldset>
            </Fieldset>
        </div>
    )
}

function App() {
    const headers = ["Mecha", "Appearances"]

    const [options, setOptions] = useState({})
    const [collapse, setCollapse] = useState(false)

    const [data, setData] = useState([])
    const [collapsedData, setCollapsedData] = useState([])

    useFetchJsonOnce('/api/getAppearances', setData)
    useFetchJsonOnce('/api/getAppearances?collapsed=1', setCollapsedData)

    return (
        <div>
            <ControlPanel options={options}
                          setOptions={setOptions}
                          collapse={collapse}
                          setCollapse={setCollapse} />
            <Table headers={headers}
                   rows={getRows(options, collapse ? collapsedData : data)} />
        </div>
    )
}

function getRows(options, data) {
    // accumulate across series
    const acc = {}
    data.filter(({series}) => options[series])
        .forEach(({appearances}) => {
            appearances.forEach(({name, total}) => {
                acc[name] = (acc[name] || 0) + total
            })
        })
    // toArray and reverse sort
    return Object.keys(acc)
        .map(name => [name, acc[name]])
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export default App
