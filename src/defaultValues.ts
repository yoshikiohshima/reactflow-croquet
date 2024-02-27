const iota = (n) => [...Array(n).keys()];
const pos = iota(32).map((i) => iota(32).map((j) => ({x: j * 60, y: i * 50}))).flat();

const nodes = pos.map((xy, i) => (
    {
        height: 10,
        id: `${i}`,
        type: 'input',
        data: {
            label: `Input Node${i}`,
        },
        position: xy,
        positionAbsolute : xy,
        style: {width: 25},
        zIndex: 100
    }
));

const edges = [];

export const defaultValues = {
    nodes,
    edges
}
