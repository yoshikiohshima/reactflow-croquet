const iota = (n) => [...Array(n).keys()];
const pos = iota(50).map((i) => iota(50).map((j) => ({x: j * 120, y: i * 80}))).flat();

const nodes = pos.map((xy, i) => (
    {
        id: `${i}`,
        type: 'input',
        data: {
            label: `Input Node${i}`,
        },
        position: xy,
        positionAbsolute : xy,
    }
));

/*const nodes = [];*/

const edges = [];

export const defaultValues = {
    nodes,
    edges
}
