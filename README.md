# ReactFlow + Croquet - Making a flowchart drawing tool collaborative

This is an demonstration of making a flowchart drawing tool collaborative by using [Croquet](https://croquet.io).

src/model.ts contains the Croquet model object. The properties declared at the top of the class are initialized in `init()`. Basically, `nodes` and `edges` are the essential data.

src/view.tsx uses ReactFlow React component to render the model state. The `model.nodes` and `model.edges` are converted to an array and used as reactive properties of the ReactFlow component.

Compared to [LiveBlocks example](https://liveblocks.io/examples/collaborative-flowchart/zustand-flowchart), this implementation is sensible to allow only one user to drag an object at a time. Also it shows the remote user's presence with a colored rectangular cursor. It also shows the realtime feedback of an edge being created when a user drags a "connection" out of a handle.

You can test it on your local computer by making a copy of dot-env-example:

   # cp dot-env-example .env.local

and then insert your Croquet development key obtained from https://croquet.io/keys into `.env.local`.

Then run: 

   # npm install
   # npm run dev

You can deploy it to your server by making a copy of dot-env-example:

   # cp dot-env-example .env.production

and insert your Croquet production key obtained from https://croquet.io/keys into `.env.production`.
