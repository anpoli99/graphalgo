// todo list:
// empty right now :)
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');

const vertices = [];
const edges = []; 
const menus = []; 
const tooltipMenus = [];
const animationObjects = [];
const infinityStr = '∞'; // used for vertex labels, edge weights, etc.
const negativeInfinityStr = '-∞';

let animationSpeedFactor = 2.0;
const animationSliderWidth = 200;
const animationSliderHeight = 20;
const maxRadius = 30, defaultRadius = 30;  
let defaultColor = 'darkblue'; // may be changed later, based on algorithm selected
const vertexBrushWidth = 4;
const vertexLabelFont = 'bold 16px Inter, sans-serif';
const vertexLabelColor = 'black';
const vertexSublabelFont = '10px Inter, sans-serif';
const vertexWarningFont = '10px Inter, sans-serif';
const vertexWarningColor = 'red';
const newVertexAnimationDuration = 1000;
const removeVertexAnimationDuration = 1000; 


const edgeBrushWidth = 5;
const edgeDefaultColor = 'lightblue';
const edgeClickThreshhold = 5; // if this close to an edge, consider it clicked
const edgeLabelFont = 'bold 16px Inter, sans-serif';
const edgeLabelColor = 'black';
const edgeWarningFont = 'bold 10px Inter, sans-serif';
const edgeWarningColor = 'red';
let weightedEdges = true; // False for algorithms like TopoSort
let directedEdges = false; // False for algorithms like MST; 
let edgeMessage = { aX : -1, aY : -1, bX : -1, bY : -1 }
const newEdgeAnimationDuration = 1000; // duration for the line to animate in
const removeEdgeAnimationDuration = 1000; // duration for the line to animate out
const directedArrowLen = 12;
const directedArrowAng = Math.PI / 3;
const directedArrowOffset = 8;


const paletteButtonWidth = 48;
const paletteMenuX = 50;
const paletteMenuY = 80;
const paletteMenuWidth = paletteButtonWidth;
const paletteMenuHeight = 4 * paletteButtonWidth; // 4 rows of buttons
const paletteMenuButtonGap = 0;
const paletteButtonBorderWidth = 1; // border width for buttons in the palette menu
const paletteMenuHighlightColor = 'rgba(200, 200, 200, 0.3)'; // highlight color for buttons in the palette menu

const codeBlockFontSize = 16;
const codeBlockFont =  `${codeBlockFontSize}px Courier New, monospace`;
const codeViewWidth = 510;
const codeViewHeight = 1000;

let currentAlgorithm = null;
let algorithmExecutor = null;
let edgeWeightValidator = null;

let sourceVertex = null;
let sinkVertex = null; // used for flow algorithms

const Mode = Object.freeze({
    ADD_VERTEX: 'ADD_VERTEX',
    DEL_VERTEX: 'DEL_VERTEX',
    ADD_EDGE: 'ADD_EDGE',
    DEL_EDGE: 'DEL_EDGE',
    MOVE_VERTEX: 'MOVE_VERTEX',
    TYPING: 'TYPING',
    RUN_ALGORITHM: 'RUN_ALGORITHM', 
    SELECT_SOURCE: 'SELECT_SOURCE',
})

const defaultMode = Mode.MOVE_VERTEX;
let mode = defaultMode;
let selectedVertex = null;
let draggingVertex = null;
let typingObject = null; // vertex or edge being typed on
let typingPreviousMode = null; // previous mode before entering TYPING mode
let typingBuffer = ''; // buffer for typing on vertex/edge
let selectSink = false; // used for flow algorithms



const unweightedFancyBlue = '#283378'; // used in a lot of algorithmas
const weightedFancyBlue = '#6870a0';
let fancyBlue = unweightedFancyBlue;

class Warning{
    constructor(text = '', expiresAt = performance.now()) {
        this.text = text;
        this.expiresAt = expiresAt;
    }
    expired(){ return this.expiresAt <= performance.now(); }
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
}
  
window.addEventListener('resize', resizeCanvas);

resizeCanvas();
const codeViewX = canvas.width - codeViewWidth - 20;
const codeViewY = 40;
const animationSliderX = canvas.width - animationSliderWidth - 20;
const animationSliderY = canvas.height - animationSliderHeight - 80;


// container for vertices
class Vertex {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = defaultRadius;
        this.color = defaultColor;
        this.warning = new Warning();
        this.name = 1;
        while (vertices.find(vertex => vertex.name == this.name)) this.name++;
        this.label = this.name;
        this.sublabel = '';
        this.birth = performance.now();
    }
    
    updateName(newName) {
        const hold = this.name;
        this.name = "tmp_" + newName;
        if (vertices.find(vertex => vertex.name == newName)) {
            const vtx = vertices.find(vertex => vertex.name == newName);
            this.warning = new Warning('Name already taken! Try another.', performance.now() + 2000);
            this.name = hold;
            return false;
        }
        this.name = newName;
        return true;
    }

    setLabel(s) {
        this.label = s;
    }
    resetLabel() {
        this.label = this.name;
    }

    setSublabel(s) {
        this.sublabel = s;
    }
    resetSublabel() {
        this.sublabel = '';
    }

    setColor(c) {
        this.color = c;
    }
    resetColor() {
        this.color = defaultColor;
    }

    // draw this vertex on the canvas
    draw(context) {
        const getRadius = () => {
            if (performance.now() - this.birth >= newVertexAnimationDuration) {
                return this.radius;
            }
            const zeta   = 0.52;   // damping ratio 0 < ζ < 1  (raise to reduce overshoot)
            const omega0 = 18;     // natural “stiffness” in rad/s (raise for snappier motion)

            const t  = (performance.now() - this.birth) / newVertexAnimationDuration;
            const ωd = omega0 * Math.sqrt(1 - zeta * zeta); 
            const decay = Math.exp(-zeta * omega0 * t);
            const coeff = Math.cos(ωd * t) +
                            (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(ωd * t);

            const r = this.radius * (1 - decay * coeff);
            return r;
        };
        context.beginPath();
        context.arc(this.x, this.y, getRadius(), 0, Math.PI * 2);
        context.lineWidth = vertexBrushWidth;
        context.strokeStyle = this.color;
        context.stroke();
        context.fillStyle = 'white';
        context.fill();
        context.closePath();
        
        context.font = vertexLabelFont;
        context.fillStyle = vertexLabelColor;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        if(mode == Mode.TYPING && typingObject == this) context.fillStyle = 'red';
        context.fillText(this.label, this.x, this.y);
        context.fillStyle = vertexLabelColor;

        context.textAlign = 'center';
        context.textBaseline = 'top';
        if (!this.warning.expired()) {
            context.font = vertexWarningFont;
            context.fillStyle = vertexWarningColor;
            context.fillText(this.warning.text, this.x, this.y + this.radius + 5);
        } else { 
            context.font = vertexSublabelFont;
            context.fillText(this.sublabel, this.x, this.y + this.radius + 5);
        }
    }
}

class Edge {
    constructor(vertexA, vertexB) {
        this.vertexA = vertexA;
        this.vertexB = vertexB;
        this.brushWidth = edgeBrushWidth;
        this.color = edgeDefaultColor;
        this.weight = Math.floor(Math.random() * 20) + 1;
        this.label = this.weight;
        this.warning = new Warning();
        this.birth = performance.now();
        this.flow = 0; // used for flow algorithms
        this.flowMode = false;
        this.textColor = 'black';
    }
    hitTest(px, py) {
        return segmentDistance(this.vertexA, this.vertexB, {x: px, y: py}) <= edgeClickThreshhold;
    }

    updateName(newWeight) {
        const num = Number(newWeight);
        if (isNaN(num) || !Number.isInteger(num)) {
            this.warning = new Warning('Weight must be an integer!', performance.now() + 2000);
            return false;
        }
        if (edgeWeightValidator && edgeWeightValidator(num) !== true) {
            this.warning = new Warning(edgeWeightValidator(num), performance.now() + 2000);
            return false;
        }
        this.weight = num;
        return true;
    }

    setLabel(s) {
        this.label = s;
    }
    resetLabel() {
        if(this.flowMode){
            this.label = this.flow + ' / ' + this.weight;
        }else{
            this.label = this.weight;
        }
    }
    setColor(c) {
        this.color = c;
    }
    resetColor() {
        this.color = edgeDefaultColor;
        this.textColor = 'black';
    }

    // draw a line between the two vertices.
    draw(context) {
        context.beginPath();
        const getLineWidth = () => {
            if (performance.now() - this.birth >= newEdgeAnimationDuration) {
                return this.brushWidth;
            }
            const zeta   = 0.38;   // damping ratio 0 < ζ < 1  (raise to reduce overshoot)
            const omega0 = 18;     // natural “stiffness” in rad/s (raise for snappier motion)

            const t  = (performance.now() - this.birth) / (newEdgeAnimationDuration / 2);
            const ωd = omega0 * Math.sqrt(1 - zeta * zeta); 
            const decay = Math.exp(-zeta * omega0 * t);
            const coeff = Math.cos(ωd * t) +
                            (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(ωd * t);

            const lw = this.brushWidth * (1 - decay * coeff);
            return lw;
        };
        if(getLineWidth() <= 0) { 
            return;
        }
        context.moveTo(this.vertexA.x, this.vertexA.y);
        context.lineTo(this.vertexB.x, this.vertexB.y);
        context.lineWidth = getLineWidth();
        context.strokeStyle = this.color;
        context.stroke();
        context.closePath();
        let midX = (this.vertexA.x + this.vertexB.x) / 2;
        let midY = (this.vertexA.y + this.vertexB.y) / 2;

        
        if ( weightedEdges ) {
            context.font = edgeLabelFont;
            context.fillStyle = this.textColor;
            if(mode == Mode.TYPING && typingObject == this) context.fillStyle = 'red';
            context.textAlign = 'center';
            context.fillText(this.label, midX, midY);
        }

        if (!this.warning.expired()) {
            context.font = edgeWarningFont;
            context.fillStyle = edgeWarningColor;
            context.textAlign = 'center';
            context.textBaseline = 'top';
            context.fillText(this.warning.text, midX, midY + 5);
        }
                
        
    }
}

function leftNormal(dx, dy) {
    const len = Math.hypot(dx, dy);
    return len === 0 ? {nx: 0, ny: 0}
                     : {nx: -dy / len, ny:  dx / len};
}
function drawArrowWedge(ctx, tipX, tipY, angle, color, percent=1) {
    /*  angle = direction of the edge (UC -: VC)
        wedge opens by +/-directedArrowAng/2 *behind* that direction */
    const a0 = angle + Math.PI - percent * directedArrowAng / 2;
    const a1 = angle + Math.PI + percent * directedArrowAng / 2;

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.arc(tipX, tipY, directedArrowLen, a0, a1, false);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}
class DirectedEdge extends Edge {
    constructor(vertexA, vertexB) {
        super(vertexA, vertexB);
    }
    hitTest(px, py) {
        const dx = this.vertexB.x - this.vertexA.x;
        const dy = this.vertexB.y - this.vertexA.y;
        const {nx, ny} = leftNormal(dx, dy);
        const ox = nx * directedArrowOffset;
        const oy = ny * directedArrowOffset;

        const len = Math.hypot(dx, dy);
        const ux = dx / len,  uy = dy / len;

        const sX = this.vertexA.x + ux * (this.vertexA.radius) + ox;
        const sY = this.vertexA.y + uy * (this.vertexA.radius) + oy;
        const eX = this.vertexB.x - ux * (this.vertexB.radius  + directedArrowLen) + ox;
        const eY = this.vertexB.y - uy * (this.vertexB.radius  + directedArrowLen) + oy;


        return segmentDistance({x: sX, y: sY}, {x: eX, y: eY}, {x: px, y: py}) <= edgeClickThreshhold;
    }
    draw(context) {
        const getLineWidth = () => {
            if (performance.now() - this.birth >= newEdgeAnimationDuration) {
                return this.brushWidth;
            }
            const zeta   = 0.38;   // damping ratio 0 < ζ < 1  (raise to reduce overshoot)
            const omega0 = 18;     // natural “stiffness” in rad/s (raise for snappier motion)

            const t  = (performance.now() - this.birth) / (newEdgeAnimationDuration / 2);
            const ωd = omega0 * Math.sqrt(1 - zeta * zeta); 
            const decay = Math.exp(-zeta * omega0 * t);
            const coeff = Math.cos(ωd * t) +
                            (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(ωd * t);

            const lw = this.brushWidth * (1 - decay * coeff);
            return lw;
        }
        const dx = this.vertexB.x - this.vertexA.x;
        const dy = this.vertexB.y - this.vertexA.y;
        const {nx, ny} = leftNormal(dx, dy);
        const ox = nx * directedArrowOffset;
        const oy = ny * directedArrowOffset;

        const len = Math.hypot(dx, dy);
        const ux = dx / len,  uy = dy / len;
        const sX = this.vertexA.x + ux * (this.vertexA.radius) + ox;
        const sY = this.vertexA.y + uy * (this.vertexA.radius) + oy;
        const eX = this.vertexB.x - ux * (this.vertexB.radius  + directedArrowLen) + ox;
        const eY = this.vertexB.y - uy * (this.vertexB.radius  + directedArrowLen) + oy;
        const cX = this.vertexB.x - ux * (this.vertexB.radius) + ox;
        const cY = this.vertexB.y - uy * (this.vertexB.radius) + oy;


        context.beginPath();
        context.moveTo(sX, sY);
        context.lineTo(eX, eY);
        context.lineWidth = getLineWidth();
        if(context.lineWidth <= 0) {
            return;
        }
        context.strokeStyle = this.color;
        context.stroke();
        context.closePath();

        const theta = Math.atan2(dy, dx);      // forward direction
        drawArrowWedge(context, cX, cY, theta, this.color);


        let midX = (sX + eX) / 2;
        let midY = (sY + eY) / 2;
        
        if (this.flowMode){
            // prevent overlapping labels; translate by 20 in the direction of the left normal
            midX += nx * 12;
            midY += ny * 12;
        }
        if ( weightedEdges ) {
            context.font = edgeLabelFont;
            context.fillStyle = this.textColor;
            if(mode == Mode.TYPING && typingObject == this) context.fillStyle = 'red';
            context.textAlign = 'center';
            context.fillText(this.label, midX, midY);
        }

        if (!this.warning.expired()) {
            context.font = edgeWarningFont;
            context.fillStyle = edgeWarningColor;
            context.textAlign = 'center';
            context.textBaseline = 'top';
            context.fillText(this.warning.text, midX, midY + 5);
        }
    }
}

        

class AnimationObject {
    constructor(lifetime) {
        this.birth = performance.now();
        this.lifetime = lifetime;
    }
    get t() { 
        return Math.min(1, (performance.now() - this.birth) / this.lifetime);
    }
    expired() { return this.t >= 1; }
    draw(context) {
        // virtual method
    }
}
class DeleteVertexAnimation extends AnimationObject {
    constructor(vertex, killBounceBack=false, lifetime=removeVertexAnimationDuration) {
        super(lifetime);
        this.x = vertex.x;
        this.y = vertex.y;
        this.radius = vertex.radius;
        this.color = vertex.color;
        this.prvZero = false;
        this.switchCount = 0;
        this.killBounceBack = killBounceBack; // if true, the vertex will stop after one bounce
    }
    draw(context) {
        
        const getRadius = () => {
            if (performance.now() - this.birth >= this.lifetime) {
                return 0;
            }
            if(this.switchCount > 1) return 0;
            const zeta   = 0.32;   // damping ratio 0 < ζ < 1  (raise to reduce overshoot)
            const omega0 = 18;     // natural “stiffness” in rad/s (raise for snappier motion)

            const t  = (performance.now() - this.birth) / this.lifetime;
            const ωd = omega0 * Math.sqrt(1 - zeta * zeta); 
            const decay = Math.exp(-zeta * omega0 * t);
            const coeff = Math.cos(ωd * t) +
                            (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(ωd * t);

            let r = this.radius * (1 - decay * coeff);
            r = this.radius - r;
            if (r < 0) r = 0;
            return r;
        };
        if (getRadius() <= 0) {
            this.prvZero = true;
            return; // don't draw if the radius is 0
        }
        if (this.prvZero){
            this.switchCount++;
        } 
        this.prvZero = false;
        if(this.switchCount >= 1 && this.killBounceBack) {
            return; 
        }
        context.beginPath();
        context.arc(this.x, this.y, getRadius(), 0, Math.PI * 2);
        context.lineWidth = vertexBrushWidth;
        
        context.beginPath();
        context.arc(this.x, this.y, getRadius(), 0, Math.PI * 2);
        context.lineWidth = vertexBrushWidth;
        context.strokeStyle = this.color;
        context.stroke();
        context.fillStyle = 'white';
        context.fill();
        context.closePath();
    }
}
class DeleteEdgeAnimation extends AnimationObject {
    constructor(edge, lifetime=removeEdgeAnimationDuration) {
        super(lifetime);
        this.vertexA = edge.vertexA;
        this.vertexB = edge.vertexB;
        this.brushWidth = edge.brushWidth;
        this.color = edge.color;
        this.hasBeenZero = 0;
        this.prvZero = false;
    }
    draw(context) {
        context.beginPath();
        const getLineWidth = () => {
            if (performance.now() - this.birth >= this.lifetime) {
                return 0;
            }
            const zeta   = 0.32;   // damping ratio 0 < ζ < 1  (raise to reduce overshoot)
            const omega0 = 18;     // natural “stiffness” in rad/s (raise for snappier motion)
            const t  = (performance.now() - this.birth) / this.lifetime;
            const ωd = omega0 * Math.sqrt(1 - zeta * zeta);
            const decay = Math.exp(-zeta * omega0 * t);
            const coeff = Math.cos(ωd * t) +
                            (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(ωd * t);
            let lw = this.brushWidth * (1 - decay * coeff);
            lw = this.brushWidth - lw;
            if (lw < 0) lw = 0;
            return lw;
        }
        if(getLineWidth() <= 0.01){
            this.prvZero = true;
            return;
        }
        if (this.prvZero){
            this.hasBeenZero++;
        }
        if (this.hasBeenZero >= 2) return;

        context.moveTo(this.vertexA.x, this.vertexA.y);
        context.lineTo(this.vertexB.x, this.vertexB.y);
        context.lineWidth = getLineWidth();
        context.strokeStyle = this.color;
        context.stroke();
        context.closePath();
    }
}

class DeleteDirectedEdgeAnimation extends AnimationObject {
    constructor(edge, lifetime=removeEdgeAnimationDuration) {
        super(lifetime);
        this.vertexA = edge.vertexA;
        this.vertexB = edge.vertexB;
        this.brushWidth = edge.brushWidth;
        this.color = edge.color;
        this.hasBeenZero = 0;
        this.prvZero = false;
    }
    draw(context) {
        const getLineWidth = () => {
            if (performance.now() - this.birth >= this.lifetime) {
                return 0;
            }
            const zeta   = 0.38;   // damping ratio 0 < ζ < 1  (raise to reduce overshoot)
            const omega0 = 18;     // natural “stiffness” in rad/s (raise for snappier motion)
            const t  = (performance.now() - this.birth) / this.lifetime;
            const ωd = omega0 * Math.sqrt(1 - zeta * zeta);
            const decay = Math.exp(-zeta * omega0 * t);
            const coeff = Math.cos(ωd * t) +
                            (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(ωd * t);
            let lw = this.brushWidth * (1 - decay * coeff);
            lw = this.brushWidth - lw;
            if (lw < 0) lw = 0;
            return lw;
        }
        const dx = this.vertexB.x - this.vertexA.x;
        const dy = this.vertexB.y - this.vertexA.y;
        const {nx, ny} = leftNormal(dx, dy);
        const ox = nx * directedArrowOffset;
        const oy = ny * directedArrowOffset;

        const len = Math.hypot(dx, dy);
        const ux = dx / len,  uy = dy / len;
        const accountForArrow = (this.t <= .25) ? directedArrowLen : 0; 
        const sX = this.vertexA.x + ux * (this.vertexA.radius) + ox;
        const sY = this.vertexA.y + uy * (this.vertexA.radius) + oy;
        const eX = this.vertexB.x - ux * (this.vertexB.radius  + accountForArrow) + ox;
        const eY = this.vertexB.y - uy * (this.vertexB.radius  + accountForArrow) + oy;
        const cX = this.vertexB.x - ux * (this.vertexB.radius) + ox;
        const cY = this.vertexB.y - uy * (this.vertexB.radius) + oy;

        if(getLineWidth() <= 0.01) {
            this.prvZero = true;
            return;
        }
        if (this.prvZero){
            this.hasBeenZero++;
        }
        if (this.hasBeenZero >= 2) return;

        context.beginPath();
        context.moveTo(sX, sY);
        context.lineTo(eX, eY);
        context.lineWidth = getLineWidth();
        context.strokeStyle = this.color;
        context.stroke();
        context.closePath();
        const theta = Math.atan2(dy, dx);
        drawArrowWedge(context, cX, cY, theta, this.color, context.lineWidth / this.brushWidth * (1 - this.t));

    }
}
    

function convertEdges(toDirected) {
    if (toDirected === directedEdges) return; // no change
    const snapshot = edges.slice(); // make a copy of the edges
    edges.slice().forEach(e => delEdge(e)); 
    directedEdges = toDirected;
    snapshot.forEach(e => {
        addEdge(e.vertexA, e.vertexB, e.label)
    });
}

function unloadAlgorithm(name){
    // reserved for future use if necessary
}
let needDirectedEdges = false;
let needUndirectedEdges = false;
function loadAlgorithm(name){
    let needSourceMenu = false;
    let needSinkMenu = false;
    needDirectedEdges = false;
    needUndirectedEdges = false;
    let needWeightedEdges = false;
    let needNonegativeWeights = false;
    let needToposortMenu = false;
    let needPositiveWeights = false;
    switch(name){
    case 'dijkstra':
        currentAlgorithm = 'dijkstra';
        algorithmExecutor = alg.dijkstra.bind(alg);
        codeView.load(dijkstraCode.split('\n'));
        needSourceMenu = true;
        needWeightedEdges = true;
        needNonegativeWeights = true;
        break;
    case 'bellmanford':
        currentAlgorithm = 'bellmanford';
        algorithmExecutor = alg.bellmanFord.bind(alg);
        codeView.load(bellmanFordCode.split('\n'));
        needSourceMenu = true;
        needWeightedEdges = true;
        needDirectedEdges = true;
        break;
    case 'bfs':
        currentAlgorithm = 'bfs';
        algorithmExecutor = alg.bfs.bind(alg);
        codeView.load(bfsCode.split('\n'));
        needSourceMenu = true;
        break;
    case 'dfs':
        currentAlgorithm = 'dfs';
        algorithmExecutor = alg.dfs.bind(alg);
        codeView.load(dfsCode.split('\n'));
        needSourceMenu = true;
        break;
    case '2coloring':
        currentAlgorithm = '2coloring';
        algorithmExecutor = alg.twoColor.bind(alg);
        codeView.load(twoColorCode.split('\n'));
        needUndirectedEdges = true;
        break;
    case 'prims':
        currentAlgorithm = 'prims';
        algorithmExecutor = alg.prims.bind(alg);
        codeView.load(primsMSTCode.split('\n'));
        needSourceMenu = true;
        needUndirectedEdges = true; 
        needWeightedEdges = true; 
        break;
    case 'kruskals':
        currentAlgorithm = 'kruskals';
        algorithmExecutor = alg.kruskals.bind(alg);
        codeView.load(kruskalsMSTCode.split('\n'));
        needUndirectedEdges = true; 
        needWeightedEdges = true; 
        break;
    case 'toposort':
        currentAlgorithm = 'toposort';
        algorithmExecutor = alg.toposort.bind(alg);
        codeView.load(toposortCode.split('\n'));
        needDirectedEdges = true;
        needToposortMenu = true;
        break;
    case 'floydwarshall':
        currentAlgorithm = 'floydwarshall';
        algorithmExecutor = alg.floydWarshall.bind(alg);
        codeView.load(floydWarshallCode.split('\n'));
        needWeightedEdges = true;
        break;
    case 'tarjan':
        currentAlgorithm = 'tarjan';
        algorithmExecutor = alg.tarjan.bind(alg);
        codeView.load(tarjanCode.split('\n'));
        needDirectedEdges = true;
        break;
    case 'edmondskarp':
        currentAlgorithm = 'edmondskarp';
        algorithmExecutor = alg.edmondsKarp.bind(alg);
        codeView.load(edmondsKarpCode.split('\n'));
        needSourceMenu = true;
        needSinkMenu = true;
        needDirectedEdges = true;
        needWeightedEdges = true;
        needPositiveWeights = true;
        break;
    }
    if (needSourceMenu){
        loadSelectSourceMenu();
    }else{
        unloadSelectSourceMenu();
    }
    if (needSinkMenu){
        loadSelectSinkMenu();
    }else{
        unloadSelectSinkMenu();
    }
    if (needDirectedEdges){
        convertEdges(true);
    }
    if (needUndirectedEdges){
        convertEdges(false);
    }
    if(!needDirectedEdges && !needUndirectedEdges){
        loadDirectedCheckbox();
    }else{
        unloadDirectedCheckbox();
    }
    if (needWeightedEdges){
        weightedEdges = true;
        fancyBlue = weightedFancyBlue;
    }else {
        weightedEdges = false;
        fancyBlue = unweightedFancyBlue;
    }
    if (needNonegativeWeights){
        edgeWeightValidator = (weight) => {
            if (weight < 0) {
                return 'Edge weights must be non-negative!';
            }
            return true;
        }
        for (let edge of edges) {
            if (Number(edge.weight) < 0) {
                edge.weight = Math.abs(Number(edge.weight));
                edge.label = edge.weight;
            }
        }
    } else if (needPositiveWeights) {
        edgeWeightValidator = (weight) => {
            if (weight <= 0) {
                return 'Edge weights must be positive!';
            }
            return true;
        }
        for (let edge of edges) {
            if (Number(edge.weight) <= 0) {
                edge.weight = Math.abs(Number(edge.weight)); // ensure positive
                if (Number(edge.weight) == 0) {
                    edge.weight = 1; // ensure positive
                }
                edge.label = edge.weight;
            }
        }
    } else {
        edgeWeightValidator = null; // no validation needed
    }
    if (needToposortMenu) {
        loadToposortMenu();
    }else{
        unloadToposortMenu();
    }
}

// helper function
// only used in toposort; assumes directed
function getCycle() { 
    // parent[i] will store the DFS tree parent of i
    const parent = new Array(vertices.length).fill(-1);
    const vis = new Array(vertices.length).fill(false);
    const on_stack = new Array(vertices.length).fill(false);
    const cycle = [];
    function dfs(u) {
        vis[u] = true;
        on_stack[u] = true;

        for (let edge of edges) {
            const u_idx = vertices.indexOf(edge.vertexA);
            const v_idx = vertices.indexOf(edge.vertexB);

            if (u_idx !== u) continue;

            if (!vis[v_idx]) {
                parent[v_idx] = u;
                if (dfs(v_idx)) return true;
            } else if (on_stack[v_idx]) {
                let cur = u;
                cycle.push(vertices[v_idx]); 
                while (cur !== v_idx) {
                    cycle.push(vertices[cur]);
                    cur = parent[cur];
                }
                cycle.reverse(); 
                return true;
            }
        }

        on_stack[u] = false;
        return false;
    }
    for (let i = 0; i < vertices.length; i++) {
        if (!vis[i]) {
            if (dfs(i)) {
                break;
            }
        }
    }
    return cycle;
}

let algorithmTerminated = false;
let algorithmPaused = false;
let algorithmRunning = false;
let pausedDuration = 0;
let showVertexSpeed = 0, messageAnimationSpeed = 0;
const messageLength = 20;
const exitSleepDuration = 1500;
class Algorithm { 
    constructor(codeView) {
        this.codeView = codeView;
    }
    async heartbeat(timeout = 1000 / 60) {
        if (algorithmTerminated) { 
            return false;
        }
        while (algorithmPaused){
            await sleep(100);
        }
        await new Promise(resolve => requestAnimationFrame(resolve));
        draw();
        showVertexSpeed = (1000 / 6) / animationSpeedFactor;
        messageAnimationSpeed = (1000 / 2) / animationSpeedFactor;
        await sleep(timeout);
        return true;
    }

    normalExit(){
        for (let vertex of vertices) {
            vertex.resetLabel();
            vertex.resetSublabel();
            vertex.resetColor();
            vertex.textColor = 'black';
        }
        edgeMessage.aX = -1;
        algorithmRunning = false;
        codeView.clearHighlight();
        codeView.clearColorText();
        for (let edge of edges) {
            edge.resetColor();
        }
    }
    dijkstraExit(){
        this.normalExit();
    }
    bfsExit() {
        this.normalExit();
    }
    dfsExit() {
        this.normalExit();
    }
    twoColorExit() { 
        this.normalExit();
    }
    bellmanFordExit() {
        this.normalExit();
    }
    primsExit() {
        this.normalExit();
    }
    kruskalsExit() {
        this.normalExit();
    }
    toposortExit() {
        this.normalExit();
        toposortMenu.text = '';
    }
    floydWarshallExit() {
        this.normalExit();
        unloadFWGrid();
    }
    tarjanExit() {
        this.normalExit();
    }
    edmondsKarpExit() {
        this.normalExit();
        const remove = []
        for(let edge of edges){
            edge.flowMode = false;
            edge.resetLabel();
            if (edge.weight == 0){
                remove.push(edge);
            }
        }
        for(let edge of remove){
            delEdge(edge);
        }
    }

    async messageAnimation(uc, vc, timeout = 1000 / 2, inverted=false){
        let u = { x: uc.x, y: uc.y, radius: uc.radius };
        let v = { x: vc.x, y: vc.y, radius: vc.radius };
        const startTime = performance.now();
        let pausedDuration = 0;
        let done = false;
        // align to edge of vertex circle 
        let dx = v.x - u.x;
        let dy = v.y - u.y;
        const len = Math.hypot(dx, dy);
        dx /= len; dy /= len; 

        // default: no lateral shift (undirected edge)
        let ox = 0, oy = 0;

        // If a directed edge exists between these two vertices, reproduce its offset
        let edgeObj = null;
        if(directedEdges){
            edgeObj = edges.find(e =>
                (e.vertexA === uc && e.vertexB === vc)
            );
        }else{
            edgeObj = edges.find(e =>
                (e.vertexA === uc && e.vertexB === vc) ||
                (e.vertexA === vc && e.vertexB === uc)
            );
        }

        if (directedEdges){
            // unit left-normal of the uc -> vc direction
            const { nx, ny } = leftNormal(dx * len, dy * len);
            const sign = (edgeObj.vertexA === uc && edgeObj.vertexB === vc) ? 1 : -1;

            ox = nx * directedArrowOffset * sign;
            oy = ny * directedArrowOffset * sign;
        }

        // start point = uc centre + forward·radiusA + lateral offset
        u.x = uc.x + dx * uc.radius + ox;
        u.y = uc.y + dy * uc.radius + oy;

        // end point   = vc centre − forward·radiusB + SAME lateral offset
        v.x = vc.x - dx * vc.radius + ox;
        v.y = vc.y - dy * vc.radius + oy;

        const distance = Math.sqrt((v.x - u.x) ** 2 + (v.y - u.y) ** 2);
        while (!done) {
            if (algorithmPaused){
                const pausedStart = performance.now();
                while (algorithmPaused) {
                    await sleep(100);
                }
                pausedDuration += performance.now() - pausedStart;
            }
            if (!(await this.heartbeat())) { 
                return false;
            }
            const now = performance.now();
            const elapsed = now - startTime - pausedDuration;
            let t = elapsed / timeout;
            if (t >= 1) {
                t = 1;
                done = true;
            }
            if (inverted) {
                t = 1 - t;
            }
            const aX = u.x + (v.x - u.x) * t;
            const aY = u.y + (v.y - u.y) * t;


            t += messageLength / distance;
            if(t >= 1){
                t = 1;
            }
            const bX = u.x + (v.x - u.x) * t;
            const bY = u.y + (v.y - u.y) * t;

            edgeMessage.aX = aX;
            edgeMessage.aY = aY;
            edgeMessage.bX = bX;
            edgeMessage.bY = bY;
        }
        edgeMessage.aX = -1;
        return true;
    }
    async highlight(idxs, color= 'rgba(138, 138, 255, 0.33)') {
        this.codeView.highlight(idxs, color);
        await new Promise(resolve => requestAnimationFrame(resolve));
    }
    async highlightAndReset(idxs, color = 'rgba(138, 138, 255, 0.33)') {
        this.codeView.clearHighlight();
        this.codeView.highlight(idxs, color);
        await new Promise(resolve => requestAnimationFrame(resolve));
    }
    findLinesByKeywords(keywords) {
        const lines = this.codeView.lineButtons;
        return lines.reduce((acc, line, idx) => {
            if (keywords.some(keyword => line.text.includes(keyword))) {
                acc.push(idx);
            }
            return acc;
        }
        , []);
    }
    async dijkstra(source) {
        // For each vertex, set its sublabel to its current label.
        for (let vertex of vertices) {
            vertex.setSublabel(vertex.label);
            vertex.setLabel('∞');
            vertex.setColor('black');
        }
        algorithmRunning = true;
        source.setLabel(0);

        // Create a visited array of size equal to the number of vertices.
        const vis = new Array(vertices.length).fill(false);
        const parent = new Array(vertices.length).fill(-1);

        if (!(await this.heartbeat(showVertexSpeed))) {
            this.dijkstraExit();
            return;
        }
        const findLinesByKeywords = this.findLinesByKeywords.bind(this);
        const highlightAndReset = this.highlightAndReset.bind(this);
        const highlight = this.highlight.bind(this);

        
        await highlightAndReset(findLinesByKeywords(['dijkstra(source)', 'vertices', 'dist[source]', 'PQ.push(source']));
        await sleep(150 / animationSpeedFactor);

        while (true) {
            // menu->highlight(k); etc
            let best = Infinity; 
            let u = -1;
            for (let i = 0; i < vertices.length; i++) {
                // Skip vertices whose label is '∞'.
                if (vertices[i].label === '∞') continue;
                if (!vis[i] && vertices[i].label < best) {
                    best = vertices[i].label;
                    u = i;
                }
            }
            if (u === -1) {
                break;
            }
            if(parent[u] !== -1) {
                let edge = null;
                if (directedEdges) {
                    edge = edges.find(e => e.vertexA === vertices[parent[u]] && e.vertexB === vertices[u]);
                } else {
                    edge = edges.find(e => (e.vertexA === vertices[parent[u]] && e.vertexB === vertices[u]) ||
                                           (e.vertexA === vertices[u] && e.vertexB === vertices[parent[u]]));
                }
                edge.color = fancyBlue;
            }
            vertices[u].setColor('lightgreen');
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.dijkstraExit();
                return;
            }
            await highlightAndReset(findLinesByKeywords(['while', '(u,']));

            // Get neighbors of vertex u.
            let u_neighbors = [];
            for (let edge of edges) {
                let idxA = vertices.indexOf(edge.vertexA);
                let idxB = vertices.indexOf(edge.vertexB);
                
                if (idxA != u){
                    if(directedEdges) continue;
                    const tmp = idxA;
                    idxA = idxB;
                    idxB = tmp;
                }
                if (idxA != u) continue;
                // Skip if already visited (blue)
                if ( !(vertices[idxB].label === '∞') && (vertices[idxB].label < vertices[u].label)) {
                    continue;   
                }
                u_neighbors.push({ idx: idxB, edge: edge });
            }

            u_neighbors.sort((a, b) => {
                const w = vertices[a.idx];
                const x = vertices[b.idx];
                return -Math.atan2(w.y - vertices[u].y, w.x - vertices[u].x) + Math.atan2(x.y - vertices[u].y, x.x - vertices[u].x);
            });


            for (let ele of u_neighbors) {
                const v = ele.idx;
                const edge = ele.edge;
                const uVertex = vertices[u];     
                let eA = edge.vertexA, eB = edge.vertexB;    

                if (directedEdges && eA !== uVertex) continue;
                if (eA !== uVertex) {
                    [eA, eB] = [eB, eA];             
                }
                
                if (!(await this.messageAnimation(eA, eB, messageAnimationSpeed))) {
                    this.dijkstraExit();
                    return;
                }
                await highlightAndReset(findLinesByKeywords(['for (v,', 'while']));
                // If vertex v's label is '∞' or can be relaxed:
                if (vertices[v].label === '∞' || vertices[v].label > vertices[u].label + edge.weight) {
                    parent[v] = u;
                    vertices[v].setLabel(vertices[u].label + edge.weight);
                    vertices[v].setColor('red');
                    await highlight(findLinesByKeywords(['if dist[v]']), 'rgba(0,255,0,0.33)');
                    await highlight(findLinesByKeywords(['dist[v] = dist_u', 'dist[v])']));
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.dijkstraExit();
                        return;
                    }
                    vertices[v].setColor('black');
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.dijkstraExit();
                        return;
                    }
                    await highlightAndReset(findLinesByKeywords(['for (v,', 'while']));
                }else{
                    await highlight(findLinesByKeywords(['if dist[v]']), 'rgba(255,0,0,0.33)');
                    if(!(await this.heartbeat(showVertexSpeed))) {
                        this.dijkstraExit();
                        return;
                    }
                    if(!(await this.heartbeat(showVertexSpeed))) {
                        this.dijkstraExit();
                        return;
                    }
                    await highlightAndReset(findLinesByKeywords(['for (v,', 'while']));
                }
            }

            // Reset the color of vertex u.
            vertices[u].setColor(defaultColor);
            vis[u] = true;
            if (!(await this.heartbeat (showVertexSpeed))) {
                this.dijkstraExit();
                return;
            }
        }
        await this.highlightAndReset(findLinesByKeywords(['return']));
        await this.heartbeat();
        await(sleep(exitSleepDuration));
        while (algorithmPaused) {
            await sleep(100);
        }
        this.dijkstraExit();
    }
    async bfs(source) {
        // give every vertex ∞, put its old label in the sublabel, paint it black
        for (const v of vertices) {
            v.setSublabel(v.label);
            v.setLabel('∞');
            v.setColor('black');
        }
        algorithmRunning = true;
        source.setLabel(0);
        const vis = new Array(vertices.length).fill(false);

        if (!(await this.heartbeat(showVertexSpeed))) {
            this.bfsExit();
            return;
        }
        const findLinesByKeywords = this.findLinesByKeywords.bind(this);
        const highlightAndReset = this.highlightAndReset.bind(this);
        const highlight = this.highlight.bind(this);
        await highlightAndReset(findLinesByKeywords(['bfs(source):', 'vertices', 'dist[source]', 'Q.push(source)']));
        await this.heartbeat(showVertexSpeed);
        await sleep(150 / animationSpeedFactor);
        const queue = [source];
        while (queue.length > 0) {
            const u = queue.shift();
            u.setColor('lightgreen');
            await highlightAndReset(findLinesByKeywords(['while', 'Q.pop()']));
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.bfsExit();
                return;
            }
            vis[vertices.indexOf(u)] = true;
            // For each neighbor v of u:
            let u_neighbors = [];
            for (let edge of edges) {
                let idxA = vertices.indexOf(edge.vertexA);
                let idxB = vertices.indexOf(edge.vertexB);
                if (idxA != vertices.indexOf(u)){
                    if(directedEdges) continue;
                    const tmp = idxA;
                    idxA = idxB;
                    idxB = tmp;
                }
                if (idxA != vertices.indexOf(u)) continue;
                // Skip if already visited (blue)
                if (vis[idxB]) {
                    // continue;   actually don't do that
                }
                u_neighbors.push({ idx: idxB, edge: edge });
            }
            u_neighbors.sort((a, b) => {
                const w = vertices[a.idx];
                const x = vertices[b.idx];
                return -Math.atan2(w.y - u.y, w.x - u.x) + Math.atan2(x.y - u.y, x.x - u.x);
            }
            );
            for (let ele of u_neighbors) {
                const v = ele.idx;
                const edge = ele.edge;
                let eA = edge.vertexA, eB = edge.vertexB;
                if (directedEdges && eA !== u)  continue;
                if (eA !== u){
                    const tmp = eA;
                    eA = eB;
                    eB = tmp;
                }
                if (!(await this.messageAnimation(eA, eB, messageAnimationSpeed))) {
                    this.bfsExit();
                    return;
                }
                await highlightAndReset(findLinesByKeywords(['for v', 'while']));
                // If vertex v's label is '∞':
                if (vertices[v].label === '∞') {
                    vertices[v].setLabel(Number(u.label) + 1);
                    vertices[v].setColor('red');
                    ele.edge.color = fancyBlue;
                    await highlight(findLinesByKeywords(['if dist[v]']), 'rgba(0,255,0,0.33)');
                    await highlight(findLinesByKeywords(['dist[v] = dist[u] + 1', 'Q.push(v)']));
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.bfsExit();
                        return;
                    }
                    queue.push(vertices[v]);
                    vertices[v].setColor('black');
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.bfsExit();
                        return;
                    }
                    await highlightAndReset(findLinesByKeywords(['for v', 'while']));
                }else{
                    await highlight(findLinesByKeywords(['if dist[v]']), 'rgba(255,0,0,0.33)');
                    if(!(await this.heartbeat(showVertexSpeed))) {
                        this.bfsExit(); 
                        return;
                    }
                    if(!(await this.heartbeat(showVertexSpeed))) {
                        this.bfsExit();
                        return;
                    }
                    await highlightAndReset(findLinesByKeywords(['for v', 'while']));
                }
            }
            // Reset the color of vertex u.
            u.setColor(defaultColor);
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.bfsExit();
                return;
            }
            await highlightAndReset(findLinesByKeywords(['while']));
            u.setColor(defaultColor);
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.bfsExit();
                return;
            }
        }
        await this.highlightAndReset(findLinesByKeywords(['return']));
        await this.heartbeat();
        await sleep(exitSleepDuration);
        while (algorithmPaused) {
            await sleep(100);
        }
        this.bfsExit();
    }
    async dfs(source) {
        // give every vertex ∞, put its old label in the sublabel, paint it black
        for (const v of vertices) {
            v.setSublabel(v.label);
            v.setLabel('∞');
            v.setColor('black');
        }
        algorithmRunning = true;
        source.setLabel(0);
        const vis = new Array(vertices.length).fill(false);
        const idx = new Array(vertices.length).fill(0);

        if (!(await this.heartbeat(showVertexSpeed))) {
            this.dfsExit();
            return;
        }
        const findLinesByKeywords = this.findLinesByKeywords.bind(this);
        const highlightAndReset = this.highlightAndReset.bind(this);
        const highlight = this.highlight.bind(this);
        await highlightAndReset(findLinesByKeywords(['dfsInit(source):', 'vertices', 'dist[source]']));
        await this.heartbeat(showVertexSpeed);
        await sleep(150 / animationSpeedFactor);
        const stack = [source];
        
        while (stack.length > 0) {
            const u = stack[stack.length - 1];
            if (idx[vertices.indexOf(u)] == 0){
                await highlightAndReset(findLinesByKeywords(['dfs(source)', 'dfsInit(source):', 'dfs(vertex):', 'visited[vertex] = true']));
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.dfsExit();
                    return;
                }
            }
            await highlightAndReset(findLinesByKeywords(['dfsInit(source):', 'dfs(source)', 'dfs(vertex):', 'for neighbor']));
            
            u.setColor('lightgreen');
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.dfsExit();
                return;
            }
            vis[vertices.indexOf(u)] = true;
            const u_neighbors = [];
            for (let edge of edges) {
                let idxA = vertices.indexOf(edge.vertexA);
                let idxB = vertices.indexOf(edge.vertexB);
                if (idxA != vertices.indexOf(u)){
                    if(directedEdges) continue;
                    const tmp = idxA;
                    idxA = idxB;
                    idxB = tmp;
                }
                if (idxA != vertices.indexOf(u)) continue;
                u_neighbors.push({ idx: idxB, edge: edge });
            }
            
            if(idx[vertices.indexOf(u)] >= u_neighbors.length) {
                for(let i = 0; i < stack.length; i++) {
                    if(stack[i] === u) {
                        stack.splice(i, 1);
                        break;
                    }
                }   
                await highlightAndReset(findLinesByKeywords(['dfs(vertex):', 'dfsInit(source):', 'dfs(source)', 'dfs(vertex):']));
                u.setColor(defaultColor);
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.dfsExit();
                    return;
                }
                continue;
            }
            u_neighbors.sort((a, b) => {
                const w = vertices[a.idx];
                const x = vertices[b.idx];
                return -Math.atan2(w.y - u.y, w.x - u.x) + Math.atan2(x.y - u.y, x.x - u.x);
            });
            for (let i = idx[vertices.indexOf(u)]; i < u_neighbors.length; i++) {
                idx[vertices.indexOf(u)] = i + 1; // increment the index for the next iteration
                const ele = u_neighbors[i];
                const v = ele.idx;
                const edge = ele.edge;
                let eA = edge.vertexA, eB = edge.vertexB;
                if (directedEdges && eA !== u)  continue;
                if (eA !== u){
                    const tmp = eA;
                    eA = eB;
                    eB = tmp;
                }
                if (!(await this.messageAnimation(eA, eB, messageAnimationSpeed))) {
                    this.dfsExit();
                    return;
                }
                await highlightAndReset(findLinesByKeywords(['for neighbor', 'dfsInit(source):', 'dfs(source)', 'dfs(vertex):']));
                // If vertex v's label is '∞':
                if (vertices[v].label === '∞') {
                    vertices[v].setLabel(Number(u.label) + 1);
                    vertices[v].setColor('red');

                    ele.edge.color = fancyBlue;
                    await highlight(findLinesByKeywords(['if not visited[neighbor]:']), 'rgba(0,255,0,0.33)');
                    await highlight(findLinesByKeywords(['dist[neighbor] = dist[vertex] + 1', 'dfs(neighbor)']));
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.dfsExit();
                        return;
                    }
                    stack.push(vertices[v]);
                    vertices[v].setColor('black');
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.dfsExit();
                        return;
                    }
                    await highlightAndReset(findLinesByKeywords(['for neighbor', 'dfsInit(source):', 'dfs(source)', 'dfs(vertex):']));
                    break;
                }else{
                    await highlight(findLinesByKeywords(['if not visited[neighbor]:']), 'rgba(255,0,0,0.33)');
                    if(!(await this.heartbeat(showVertexSpeed))) {
                        this.dfsExit();
                        return;
                    }
                    if(!(await this.heartbeat(showVertexSpeed))) {
                        this.dfsExit();
                        return;
                    }
                    await highlightAndReset(findLinesByKeywords(['for neighbor', 'dfsInit(source):', 'dfs(source)', 'dfs(vertex):']));
                }
            }
        }
        await this.highlightAndReset(findLinesByKeywords(['return']));
        await this.heartbeat();
        await sleep(exitSleepDuration);
        while (algorithmPaused) {
            await sleep(100);
        }
        this.dfsExit();
    }
    async twoColor(){
        algorithmRunning = true;
        const color1 = 'darkblue';
        const color2 =  '#DC143C';
        for (const v of vertices) {
            v.setColor('black');
        }
        const findLinesByKeywords = this.findLinesByKeywords.bind(this);
        const highlightAndReset = this.highlightAndReset.bind(this);
        const highlight = this.highlight.bind(this);
        const ifColorIdx = findLinesByKeywords(['if color[v] == -1']).sort((a, b) => a - b);
        const returnTrueIdx = findLinesByKeywords(['return true']).sort((a, b) => a - b);
        await highlightAndReset(findLinesByKeywords(['twoColorInit():', 'color[v] = -1']));
        if (!(await this.heartbeat(showVertexSpeed))) {
            this.twoColorExit();
            return;
        }
        await sleep(150 / animationSpeedFactor);
        for (let source of vertices) {
            if (source.color !== 'black') {
                // await highlightAndReset(findLinesByKeywords(['if color[source] == -1']), 'rgba(255,0,0,0.33)');
                await highlightAndReset([ifColorIdx[1]], 'rgba(255,0,0,0.33)');
                await highlight(findLinesByKeywords(['twoColorInit():', 'for v in v']));
                const tmp = source.color;
                source.setColor('red');
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.twoColorExit();
                    return;
                }
                source.setColor(tmp);
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.twoColorExit();
                    return;
                }
                await sleep(150 / animationSpeedFactor);
                continue;
            }
            source.setColor('lightgreen');
            const alwaysBlue = findLinesByKeywords(['twoColor(source)','for v in vertices:', 'if not'])
            await highlightAndReset(alwaysBlue);
            await highlight([ifColorIdx[1]], 'rgba(0,255,0,0.33)');
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.twoColorExit();
                return;
            }
            source.setColor(color1);
            await highlightAndReset(findLinesByKeywords(['Q.push(source)', 'color[source]']));
            // await highlight(findLinesByKeywords(['if color[v] == -1']), 'rgba(0,255,0,0.33)');
            await highlight([ifColorIdx[1]], 'rgba(0,255,0,0.33)');
            await highlight(alwaysBlue);
            await this.heartbeat(showVertexSpeed);
            await sleep(150 / animationSpeedFactor);
            const queue = [source];
            while (queue.length > 0) {
                await highlightAndReset(findLinesByKeywords(['while', 'Q.pop()']));
                await highlight(alwaysBlue);
                const u = queue.shift();
                const prevColor = u.color;
                const uVtx = vertices[vertices.indexOf(u)];
                uVtx.textColor = 'lightgreen';
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.twoColorExit();
                    return;
                }
                const u_neighbors = [];
                for (let edge of edges) {
                    let idxA = vertices.indexOf(edge.vertexA);
                    let idxB = vertices.indexOf(edge.vertexB);
                    if (idxA != vertices.indexOf(u)){
                        const tmp = idxA;
                        idxA = idxB;
                        idxB = tmp;
                    }
                    if (idxA != vertices.indexOf(u)) continue;
                    u_neighbors.push({ idx: idxB, edge: edge });
                }
                u_neighbors.sort((a, b) => {
                    const w = vertices[a.idx];
                    const x = vertices[b.idx];
                    return -Math.atan2(w.y - u.y, w.x - u.x) + Math.atan2(x.y - u.y, x.x - u.x);
                }
                );
                for (let ele of u_neighbors) {
                    const v = ele.idx;
                    const edge = ele.edge;
                    let eA = edge.vertexA, eB = edge.vertexB;
                    if (eA !== u){
                        const tmp = eA;
                        eA = eB;
                        eB = tmp;
                    }
                    await highlightAndReset(findLinesByKeywords(['for v in n', 'while']));
                    await highlight(alwaysBlue);
                    if (!(await this.messageAnimation(eA, eB, messageAnimationSpeed))) {
                        this.twoColorExit();
                        return;
                    }
                    // If vertex v's color is -1:
                    if (vertices[v].color === 'black') {
                        vertices[v].setColor(prevColor === color1 ? color2 : color1);
                        // await highlight(findLinesByKeywords(['if color[v] == -1']), 'rgba(0,255,0,0.33)');
                        await highlight([ifColorIdx[0]], 'rgba(0,255,0,0.33)');
                        await highlight(findLinesByKeywords(['color[v] = 1 -', 'Q.push(v)']));
                        if (!(await this.heartbeat(showVertexSpeed))) {
                            this.twoColorExit();
                            return;
                        }
                        queue.push(vertices[v]);
                        if (!(await this.heartbeat(showVertexSpeed))) {
                            this.twoColorExit();
                            return;
                        }
                        await highlightAndReset(findLinesByKeywords(['for v in nr', 'while']));
                        await highlight(alwaysBlue);
                    }else if (vertices[v].color === prevColor){
                        // await highlight(findLinesByKeywords(['if color[neighbor] == -1']), 'rgba(255,0,0,0.33)');
                        await highlight([ifColorIdx[0]], 'rgba(255,0,0,0.33)'); 
                        await highlight(findLinesByKeywords(['else if']), 'rgba(0,255,0,0.33)');
                        await highlight(findLinesByKeywords(['return false']));
                        await highlight(findLinesByKeywords(['if not']), 'rgba(0,255,0,0.33)');
                        u.setColor(prevColor);
                        ele.edge.setColor('red');
                        if(!(await this.heartbeat(showVertexSpeed))) {
                            this.twoColorExit();
                            return;
                        }
                        if(!(await this.heartbeat(showVertexSpeed))) {
                            this.twoColorExit();
                            return;
                        }
                        await this.heartbeat();
                        await sleep(exitSleepDuration);
                        while (algorithmPaused) {
                            await sleep(100);
                        }
                        this.twoColorExit();
                        return;
                    }else{
                        // await highlight(findLinesByKeywords(['if color[neighbor] == -1']), 'rgba(255,0,0,0.33)');
                        await highlight([ifColorIdx[0]], 'rgba(255,0,0,0.33)');
                        await highlight(findLinesByKeywords(['else if']), 'rgba(255,0,0,0.33)');
                        if(!(await this.heartbeat(showVertexSpeed))) {
                            this.twoColorExit();
                            return;
                        }
                        if(!(await this.heartbeat(showVertexSpeed))) {
                            this.twoColorExit();
                            return;
                        }
                    }
                }
                u.setColor(prevColor);
                uVtx.textColor = 'black';
            }
            this.highlightAndReset([returnTrueIdx[0]]);
            this.highlight(findLinesByKeywords(['if not']), 'rgba(255,0,0,0.33)');
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.twoColorExit();
                return;
            }
        }
        for (let e of edges){
            e.color = 'lightgreen';
        }
        await this.highlightAndReset([returnTrueIdx[1]]);
        await this.heartbeat();
        await sleep(exitSleepDuration);
        while (algorithmPaused) {
            await sleep(100);
        }
        this.twoColorExit();
        return;
    }
    async bellmanFord(source) {
        // give every vertex ∞, put its old label in the sublabel, paint it black
        for (const v of vertices) {
            v.setSublabel(v.label);
            v.setLabel('∞');
            v.setColor('black');
        }
        algorithmRunning = true;
        source.setLabel(0);

        if (!(await this.heartbeat(showVertexSpeed))) {
            this.bellmanFordExit();
            return;
        }
        const findLinesByKeywords = this.findLinesByKeywords.bind(this);
        const highlightAndReset = this.highlightAndReset.bind(this);
        const highlight = this.highlight.bind(this);
        await highlightAndReset(findLinesByKeywords(['bellmanFord(source):', 'vertices', 'dist[source]']));
        await this.heartbeat(showVertexSpeed);
        await sleep(150 / animationSpeedFactor);
        const forLoopIndices = this.findLinesByKeywords(['for (u, v, weight) in edges:']).sort((a, b) => a - b);
        const ifIndices = this.findLinesByKeywords(['if dist[u]']).sort((a, b) => a - b);

        // keep a list of active edges for each vertex, init to null
        const activeEdges = new Array(vertices.length).fill(null);

        // Relax all edges |V| - 1 times
        for(let i = 0; i < vertices.length - 1; i++){
            await highlightAndReset(findLinesByKeywords(['|V| - 1']));
            await highlight(findLinesByKeywords(['anyUpdates = false']));
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.bellmanFordExit();
                return;
            }
            await sleep(150 / animationSpeedFactor);
            let anyUpdates = false;
            for (let edge of edges) {
                await highlightAndReset(findLinesByKeywords(['|V| - 1']).concat(forLoopIndices[0]));
                const u = vertices.indexOf(edge.vertexA);
                const v = vertices.indexOf(edge.vertexB);
                if(!(await this.messageAnimation(edge.vertexA, edge.vertexB, messageAnimationSpeed))) {
                    this.bellmanFordExit();
                    return;
                }
                if (vertices[u].label === '∞')  continue; // skip if u is unreachable
                if (vertices[v].label > vertices[u].label + edge.weight || vertices[v].label === '∞') {
                    vertices[v].setLabel(vertices[u].label + edge.weight);
                    
                    vertices[v].setColor('red');
                    if(activeEdges[v] !== null) {
                        activeEdges[v].color = edgeDefaultColor;
                    }
                    activeEdges[v] = edge;
                    edge.color = fancyBlue;
                    await highlight([ifIndices[0]], 'rgba(0,255,0,0.33)');
                    await highlight(findLinesByKeywords(['dist[v] = dist[u] + weight', 'anyUpdates = true']));
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.bellmanFordExit();
                        return;
                    }
                    anyUpdates = true;
                    vertices[v].setColor('black');
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.bellmanFordExit();
                        return;
                    }
                }else{
                    await highlight([ifIndices[0]], 'rgba(255,0,0,0.33)');
                    if(!(await this.heartbeat(showVertexSpeed))) {
                        this.bellmanFordExit();
                        return;
                    }
                    if(!(await this.heartbeat(showVertexSpeed))) {
                        this.bellmanFordExit();
                        return;
                    }
                }
            }
            await highlightAndReset(findLinesByKeywords(['|V| - 1']))
            if (!anyUpdates){
                await highlight(findLinesByKeywords(['if not']), 'rgba(0,255,0,0.33)');
                await highlight(findLinesByKeywords(['break']));
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.bellmanFordExit();
                    return;
                }
                break; // no updates, so we can stop
            }else{
                await highlight(findLinesByKeywords(['if not']), 'rgba(255,0,0,0.33)');
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.bellmanFordExit();
                    return;
                }
            }
        }

        // Check for negative cycles, and propagate -∞
        await highlightAndReset(findLinesByKeywords(['// Check', 'Q;']));
        if (!(await this.heartbeat(showVertexSpeed))) {
            this.bellmanFordExit();
            return;
        }
        await sleep(150 / animationSpeedFactor);
        const queue = [];
        for (let edge of edges) {
            await highlightAndReset(findLinesByKeywords(['// Check']).concat(forLoopIndices[1]));
            const u = vertices.indexOf(edge.vertexA);
            const v = vertices.indexOf(edge.vertexB);
            if(!(await this.messageAnimation(edge.vertexA, edge.vertexB, messageAnimationSpeed))) {
                this.bellmanFordExit();
                return;
            }
            if (vertices[u].label === '∞') continue; // skip if u is unreachable
            if (vertices[v].label > vertices[u].label + edge.weight) {
                vertices[v].setLabel('-∞');
                vertices[v].setColor('red');
                await highlight([ifIndices[1]], 'rgba(0,255,0,0.33)');
                await highlight(findLinesByKeywords(['dist[v] = -∞', 'Q.push(v)']));
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.bellmanFordExit();
                    return;
                }
                queue.push(vertices[v]);
                vertices[v].setColor('black');
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.bellmanFordExit();
                    return;
                }
            }else{
                await highlight([ifIndices[1]], 'rgba(255,0,0,0.33)');
                if(!(await this.heartbeat(showVertexSpeed))) {
                    this.bellmanFordExit();
                    return;
                }
                if(!(await this.heartbeat(showVertexSpeed))) {
                    this.bellmanFordExit();
                    return;
                }
            }
        }
        await highlightAndReset(findLinesByKeywords(['// Check']));
        if (!(await this.heartbeat(showVertexSpeed))) {
            this.bellmanFordExit();
            return;
        }
        if (queue.length === 0) {
            await highlightAndReset(findLinesByKeywords([ 'while Q is not empty:']), 'rgba(255,0,0,0.33)');
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.bellmanFordExit();
                return;
            }
            await sleep(150 / animationSpeedFactor);
        }
        // Propagate -∞ to all reachable vertices
        while (queue.length > 0) {
            const v = queue.shift();
            v.setColor('red');
            await highlightAndReset(findLinesByKeywords(['while Q is not empty:', 'Q.pop()']));
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.bellmanFordExit();
                return;
            }
            for (let edge of edges) {
                let idxA = vertices.indexOf(edge.vertexA);
                let idxB = vertices.indexOf(edge.vertexB);
                if (idxA != vertices.indexOf(v)){
                    if(directedEdges) continue;
                    const tmp = idxA;
                    idxA = idxB;
                    idxB = tmp;
                }
                if (idxA != vertices.indexOf(v)) continue;
                await highlightAndReset(findLinesByKeywords(['while', 'neighbors']));
                const neighbor = vertices[idxB];
                if(!(await this.messageAnimation(v, neighbor, messageAnimationSpeed))) {
                    this.bellmanFordExit();
                    return;
                }
                if (neighbor.label !== '-∞') {
                    neighbor.setLabel('-∞');
                    queue.push(neighbor);
                    await highlight(findLinesByKeywords(['if dist[neighbor] != -∞:']), 'rgba(0,255,0,0.33)');
                    await highlight(findLinesByKeywords(['dist[neighbor] = -∞']));
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.bellmanFordExit();
                        return;
                    }
                }else{
                    await highlight(findLinesByKeywords(['if dist[neighbor] != -∞:']), 'rgba(255,0,0,0.33)');
                    if(!(await this.heartbeat(showVertexSpeed))) {
                        this.bellmanFordExit();
                        return;
                    }
                    if(!(await this.heartbeat(showVertexSpeed))) {
                        this.bellmanFordExit();
                        return;
                    }
                }
                // v.setColor(defaultColor);
            }
        }
        for (let vertex of vertices) {
            vertex.setColor(defaultColor);
        }
        await this.highlightAndReset(findLinesByKeywords(['return']));
        await this.heartbeat();
        await sleep(exitSleepDuration);
        while (algorithmPaused) {
            await sleep(100);
        }
        this.bellmanFordExit();
    }
    async prims(source) {
        if(directedEdges){
            console.error('Prims algorithm does not support directed edges');
            return;
        }
        // For each vertex, set its sublabel to its current label.
        for (let vertex of vertices) {
            vertex.setSublabel(vertex.label);
            vertex.setLabel('∞');
            vertex.setColor('black');
        }
        algorithmRunning = true;
        source.setLabel(0);
        // Create a visited array of size equal to the number of vertices.
        const vis = new Array(vertices.length).fill(false);
        const parent = new Array(vertices.length).fill(null);
        
        if (!(await this.heartbeat(showVertexSpeed))) {
            this.primsExit();
            return;
        }
        const findLinesByKeywords = this.findLinesByKeywords.bind(this);
        const highlightAndReset = this.highlightAndReset.bind(this);
        const highlight = this.highlight.bind(this);
        await highlightAndReset(findLinesByKeywords(['primsMST(source):', 'vertices', 'dist[source]', 'PQ.push(source,']));

        await this.heartbeat(showVertexSpeed);
        await sleep(150 / animationSpeedFactor);
       
        while (true) {
            await highlightAndReset(findLinesByKeywords(['while PQ is not empty:']));
            // menu->highlight(k); etc
            let best = Infinity; 
            let u = -1;
            for (let i = 0; i < vertices.length; i++) {
                // Skip vertices whose label is '∞'.
                if (vertices[i].label === '∞') continue;
                if (!vis[i] && vertices[i].label < best) {
                    best = vertices[i].label;
                    u = i;
                }
            }
            if (u === -1) {
                break;
            }
            vis[u] = true; // mark u as visited
            

            vertices[u].setColor('lightgreen');
            await highlightAndReset(findLinesByKeywords(['while', '(u,']));
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.primsExit();
                return;
            }
            await highlightAndReset(findLinesByKeywords(['while']))

            
            // If u has a parent, add the edge to the MST.
            if (parent[u] !== null) {
                const parentVertex = vertices[parent[u]];
                const edge = edges.find(e => (e.vertexA === parentVertex && e.vertexB === vertices[u]) || (e.vertexB === parentVertex && e.vertexA === vertices[u]));
                if (edge) {
                    edge.setColor(fancyBlue);
                    await highlight(findLinesByKeywords(['if parent[u] is not None:']), 'rgba(0,255,0,0.33)');
                    await highlight(findLinesByKeywords(['add edge (parent[u], u) to MST']));
                    await sleep(100 / animationSpeedFactor);
                }
            }else{
                await highlight(findLinesByKeywords(['if parent[u] is not None:']), 'rgba(255,0,0,0.33)');
                if(!(await this.heartbeat(showVertexSpeed))) {
                    this.primsExit();
                    return;
                }
                await sleep(50 / animationSpeedFactor);
            }

            await highlightAndReset(findLinesByKeywords(['while', 'for (v,']));
            
            // Get neighbors of vertex u.
            let u_neighbors = [];
            for (let edge of edges) {
                let idxA = vertices.indexOf(edge.vertexA);
                let idxB = vertices.indexOf(edge.vertexB);
                if (idxA != u){
                    const tmp = idxA;
                    idxA = idxB;
                    idxB = tmp;
                }
                if (idxA != u) continue;
                // Skip if already visited (blue)
                if (vis[idxB]) {
                    continue;   
                }
                u_neighbors.push({ idx: idxB, edge: edge });
            }

            u_neighbors.sort((a, b) => {
                const w = vertices[a.idx];
                const x = vertices[b.idx];
                return -Math.atan2(w.y - vertices[u].y, w.x - vertices[u].x) + Math.atan2(x.y - vertices[u].y, x.x - vertices[u].x);
            });
            for (let ele of u_neighbors) {
                const v = ele.idx;
                const edge = ele.edge;
                const uVertex = vertices[u];
                let eA = edge.vertexA, eB = edge.vertexB;    

                if (directedEdges && eA !== uVertex) continue;
                if (eA !== uVertex) {
                    [eA, eB] = [eB, eA];             
                }
                if (!(await this.messageAnimation(eA, eB, messageAnimationSpeed))) {
                    this.primsExit();
                    return;
                }
                await highlightAndReset(findLinesByKeywords(['for (v,', 'while']));
                // If vertex v's label is '∞' or can be relaxed:
                if (vertices[v].label === '∞' || vertices[v].label > edge.weight) {

                    vertices[v].setLabel(edge.weight);
                    vertices[v].setColor('red');
                    parent[v] = u; // set parent
                    await highlight(findLinesByKeywords(['if dist[v]']), 'rgba(0,255,0,0.33)');
                    await highlight(findLinesByKeywords(['dist[v] = weight', 'parent[v] = u', 'PQ.decreaseKey(v, dist[v])']));
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.primsExit();
                        return;
                    }
                    vertices[v].setColor('black');
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.primsExit();
                        return;
                    }
                    await highlightAndReset(findLinesByKeywords(['for (v,', 'while']));
                }else{
                    await highlight(findLinesByKeywords(['if dist[v]']), 'rgba(255,0,0,0.33)');
                    if(!(await this.heartbeat(showVertexSpeed))) {
                        this.primsExit();
                        return;
                    }
                    if(!(await this.heartbeat(showVertexSpeed))) {
                        this.primsExit();
                        return;
                    }
                    await highlightAndReset(findLinesByKeywords(['for (v,', 'while']));
                }
                if(!(await this.heartbeat(showVertexSpeed))) {
                    this.primsExit();
                    return;
                }
            }
            vertices[u].setColor(defaultColor);
            if (!(await this.heartbeat (showVertexSpeed))) {
                this.primsExit();
                return;
            }
        }
        await highlightAndReset(findLinesByKeywords(['return']));
        await this.heartbeat();
        await sleep(exitSleepDuration);
        while (algorithmPaused) {
            await sleep(100);
        }
        this.primsExit();
    }
    async kruskals() {
        algorithmRunning = true;
        if(directedEdges){
            console.error('Kruskal\'s algorithm does not support directed edges');
            return;
        }
        const findLinesByKeywords = this.findLinesByKeywords.bind(this);
        const highlightAndReset = this.highlightAndReset.bind(this);
        const highlight = this.highlight.bind(this);

        highlightAndReset(findLinesByKeywords(['kruskalsMST():', 'edges.sort()']));
        if (!(await this.heartbeat(showVertexSpeed))) {
            this.kruskalsExit();
            return;
        }
        await sleep(150 / animationSpeedFactor);
        
        // Sort edges by weight
        edges.sort((a, b) => a.weight - b.weight);
        await highlightAndReset(findLinesByKeywords(['kruskalsMST():', 'edges.sort()']));
        if (!(await this.heartbeat(showVertexSpeed))) {
            this.kruskalsExit();
            return;
        }
        const parent = new Array(vertices.length).fill(0);
        for(let i = 0; i < parent.length; i++) {
            parent[i] = i; // Initialize each vertex to be its own parent
        }
        for(const edge of edges) {
            await highlightAndReset(findLinesByKeywords(['for']));
            const u = edge.vertexA, v = edge.vertexB;
            const ux = vertices.indexOf(u), vx = vertices.indexOf(v);
            if(parent[ux] !== parent[vx]){
                const tmp = parent[vx];
                for (let i = 0; i < parent.length; i++) {
                    if(parent[i] === tmp) {
                        parent[i] = parent[ux]; // Union operation
                    }
                }
                await highlightAndReset(findLinesByKeywords(['if']), 'rgba(0,255,0,0.33)');
                await highlight(findLinesByKeywords(['for', 'add', 'union']));
                edge.setColor('lightgreen');
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.kruskalsExit();
                    return;
                }
                await sleep(75 / animationSpeedFactor);
                edge.setColor(fancyBlue); // Set to fancy blue
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.kruskalsExit();
                    return;
                }
            }else{
                await highlightAndReset(findLinesByKeywords(['if']), 'rgba(255,0,0,0.33)');
                await highlight(findLinesByKeywords(['for']))
                edge.setColor('red');
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.kruskalsExit();
                    return;
                }
                await sleep(75 / animationSpeedFactor);
                edge.setColor('#AAAAAA'); // Reset color
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.kruskalsExit();
                    return;
                }
            }
        }

        await highlightAndReset(findLinesByKeywords(['return']));
        await this.heartbeat();
        await sleep(exitSleepDuration);
        while (algorithmPaused) {
            await sleep(100);
        }
        this.kruskalsExit();
    }
    async toposort(){
        if(!directedEdges){
            console.error('Topological sort only works on directed graphs');
            return;
        }
        algorithmRunning = true;
        for (const v of vertices) {
            v.setSublabel(v.label);
            v.setLabel('0');
            v.setColor('black');
        }
        const in_degree = new Array(vertices.length).fill(0);
        const findLinesByKeywords = this.findLinesByKeywords.bind(this);
        const highlightAndReset = this.highlightAndReset.bind(this);
        const highlight = this.highlight.bind(this);
        
        const qpushIdx = this.findLinesByKeywords(['Q.push(v)']).sort((a, b) => a - b);
        const ifIndegZeroIdx = this.findLinesByKeywords(['if in_degree[v] == 0:']).sort((a, b) => a - b);

        await highlightAndReset(findLinesByKeywords(['topologicalSort():', 'in_degree[v] = 0 for all vertices v']));
        await this.heartbeat(showVertexSpeed);
        await sleep(150 / animationSpeedFactor);
        // Calculate in-degree for each vertex
        for (let edge of edges) {
            let idxA = vertices.indexOf(edge.vertexA);
            let idxB = vertices.indexOf(edge.vertexB);
            await highlightAndReset(findLinesByKeywords(['for (u, v) in edges:']));
            if(!(await this.messageAnimation(edge.vertexA, edge.vertexB, messageAnimationSpeed))) {
                this.toposortExit();
                return;
            }
            in_degree[idxB]++;
            vertices[idxB].setLabel(in_degree[idxB]);
            vertices[idxB].setColor('red');
            await highlight(findLinesByKeywords(['in_degree[v] += 1']));
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.toposortExit();
                return;
            }
            vertices[idxB].setColor('black');
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.toposortExit();
                return;
            }
            await highlightAndReset(findLinesByKeywords(['for (u, v) in edges:']));
        }

        const queue = [];
        for (let i = 0; i < vertices.length; i++) {
            await highlightAndReset(findLinesByKeywords(['for v in vertices:']));
            if (in_degree[i] === 0) {
                queue.push(vertices[i]);
                await highlight([ifIndegZeroIdx[0]], 'rgba(0,255,0,0.33)');
                await highlight([qpushIdx[0]]);
                vertices[i].setColor('lightgreen');
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.toposortExit();
                    return;
                }
                vertices[i].setColor('black');
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.toposortExit();
                    return;
                }
            }else{
                vertices[i].setColor('red');
                await highlight([ifIndegZeroIdx[0]], 'rgba(255,0,0,0.33)');
                if(!(await this.heartbeat(showVertexSpeed))) {
                    this.toposortExit();
                    return;
                }
                vertices[i].setColor('black');
                if(!(await this.heartbeat(showVertexSpeed))) {
                    this.toposortExit();
                    return;
                }
            }
        }   

        const sorted = [];
        if(queue.length == 0){
            await highlightAndReset(findLinesByKeywords(['while Q is not empty:']), 'rgba(255,0,0,0.33)');
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.toposortExit();
                return;
            }
            await sleep(150 / animationSpeedFactor);
        }else{
            await highlightAndReset(findLinesByKeywords(['while Q is not empty:']));
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.toposortExit();
                return;
            }
            await sleep(150 / animationSpeedFactor);
            while (queue.length > 0) {
                const u = queue.shift();
                u.setColor('lightgreen');
                await highlightAndReset(findLinesByKeywords(['while', 'Q.pop()']));
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.toposortExit();
                    return;
                }
                sorted.push(u);
                toposortMenu.text = 'sorted= '+ sorted.map(v => v.sublabel).join(', ');
                const u_neighbors = [];
                for (let edge of edges) {
                    let idxA = vertices.indexOf(edge.vertexA);
                    let idxB = vertices.indexOf(edge.vertexB);
                    if (idxA != vertices.indexOf(u)){
                        continue;
                    }
                    u_neighbors.push({ idx: idxB, edge: edge });
                }
                u_neighbors.sort((a, b) => {
                    const w = vertices[a.idx];
                    const x = vertices[b.idx];
                    return -Math.atan2(w.y - u.y, w.x - u.x) + Math.atan2(x.y - u.y, x.x - u.x);
                }
                );
                for (let ele of u_neighbors) {
                    const v = ele.idx;
                    const edge = ele.edge;
                    if (!(await this.messageAnimation(edge.vertexA, edge.vertexB, messageAnimationSpeed))) {
                        this.toposortExit();
                        return;
                    }
                    edge.color = '#F3F3F3'; // used edge
                    await highlightAndReset(findLinesByKeywords(['while', 'neighbors', 'in_degree[v] -= 1']));
                    // If vertex v's in-degree is 0:
                    in_degree[v]--;
                    vertices[v].setLabel(in_degree[v]);
                    vertices[v].setColor('red');
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.toposortExit();
                        return;
                    }
                    if (in_degree[v] === 0) {
                        queue.push(vertices[v]);
                        vertices[v].setColor('lightgreen');
                        await highlight([ifIndegZeroIdx[1]], 'rgba(0,255,0,0.33)');
                        await highlight([qpushIdx[1]]);
                        if (!(await this.heartbeat(showVertexSpeed))) {
                            this.toposortExit();
                            return;
                        }
                        vertices[v].setColor('black');
                        if (!(await this.heartbeat(showVertexSpeed))) {
                            this.toposortExit();
                            return;
                        }
                    }else{
                        await highlight([ifIndegZeroIdx[1]], 'rgba(255,0,0,0.33)');
                        if(!(await this.heartbeat(showVertexSpeed))) {
                            this.toposortExit();
                            return;
                        }
                        vertices[v].setColor('black');  
                        if(!(await this.heartbeat(showVertexSpeed))) {
                            this.toposortExit();
                            return;
                        }
                    }
                    await highlightAndReset(findLinesByKeywords(['while', 'neighbors']));
                }
                u.setColor(defaultColor);
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.toposortExit();
                    return;
                }
            }
        }
        if(sorted.length !== vertices.length) {
            const cycle = getCycle();
            const len = cycle.length;
            cycle.push(cycle[0]);
            for( let i = 0; i < len; i++) {
                await highlightAndReset(findLinesByKeywords(['if len(sorted) != |V|:']), 'rgba(255,0,0,0.33)');
                await highlight(findLinesByKeywords(['// Cycle detected!']));
                console.log(cycle[i].label)
                const eA = cycle[i], eB = cycle[i + 1];
                if(!(await this.messageAnimation(eA, eB, messageAnimationSpeed))) {
                    this.toposortExit();
                    return;
                }
                const vtx = vertices[vertices.indexOf(eB)];
                vtx.setColor('red');
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.toposortExit();
                    return;
                }
                const edge = edges.find(e => (e.vertexA === eA && e.vertexB === eB));
                edge.color = 'red';
            }
            await highlightAndReset(findLinesByKeywords(['return []']));
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.toposortExit();
                return;
            }
        }else{
            await highlightAndReset(findLinesByKeywords(['return sorted']));
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.toposortExit();
                return;
            }
        }
        await this.heartbeat();
        await sleep(exitSleepDuration);
        while (algorithmPaused) {
            await sleep(100);
        }
        this.toposortExit();
    }
    async floydWarshall() {
        algorithmRunning = true; // i give up on the long keynames
        const findlines = this.findLinesByKeywords.bind(this);
        const hlr = this.highlightAndReset.bind(this);
        const hl = this.highlight.bind(this);

        const forUIdx = findlines(['for u in vertices:']).sort((a, b) => a - b);
        

        const inf = Infinity;
        const n = vertices.length;
        const dist = Array.from({length: n}, () => Array(n).fill(inf));
        const path = Array.from({ length: n }, () => Array(n).fill(null));


        loadFWGrid();
        fwGrid.init();
        await hlr(findlines(['floydWarshall():', 'dist[u][v] = ∞ for all vertices u, v']));
        await this.heartbeat(showVertexSpeed);
        await sleep(150 / animationSpeedFactor);

        for(let i = 0; i < vertices.length; i++){
            await hlr([forUIdx[0]]);
            await hl(findlines(['dist[u][u] = 0']));
            vertices[i].setColor('lightgreen');
            fwGrid.setValue(i, i, 0);
            path[i][i] = [i];
            dist[i][i] = 0;
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.floydWarshallExit();
                return;
            }
            const u = vertices[i];
            const u_neighbors = [];
            for (let edge of edges) {
                let idxA = vertices.indexOf(edge.vertexA);
                let idxB = vertices.indexOf(edge.vertexB);
                if(idxA != i && !directedEdges){
                    const tmp = idxA;
                    idxA = idxB;
                    idxB = tmp;
                }
                if (vertices[idxA] !== u) {
                    continue;
                }
                u_neighbors.push({ idx: idxB, edge: edge });
            }
            u_neighbors.sort((a, b) => {
                const w = vertices[a.idx];
                const x = vertices[b.idx];
                return -Math.atan2(w.y - u.y, w.x - u.x) + Math.atan2(x.y - u.y, x.x - u.x);
            });
            for (let ele of u_neighbors) {
                const v = ele.idx;
                const edge = ele.edge;
                await hlr(findlines(['for (v,w) in neighbors(u):']));
                if (!(await this.messageAnimation(edge.vertexA, edge.vertexB, messageAnimationSpeed / 2))) {
                    this.floydWarshallExit();
                    return;
                }
                await hl(findlines(['dist[u][v] = w']));
                dist[i][v] = edge.weight;
                path[i][v] = [i, v];
                fwGrid.setValue(i, v, edge.weight);
                fwGrid.buttons[i][v].highlightColor = 'lightgreen';
                vertices[v].setColor('red');
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.floydWarshallExit();
                    return;
                }
                vertices[v].setColor('black');
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.floydWarshallExit();
                    return;
                }
                fwGrid.buttons[i][v].highlightColor = null;
            }


            vertices[i].setColor('black');
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.floydWarshallExit();
                return;
            }
        }


        await hlr(findlines(['for k in vertices:']));
        await hl([forUIdx[1]]);
        await hl(findlines(['for v in vertices:']));
        for (let k = 0; k < vertices.length; k++) {
            vertices[k].setColor('yellow');
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.floydWarshallExit();
                return;
            }
            for (let i = 0; i < vertices.length; i++) {
                for ( let j = 0; j < vertices.length; j++) {
                    if(i == k || j == k) continue; // i'm just skipping this w/e
                    await hlr(findlines(['for k in vertices:']));
                    await hl([forUIdx[1]]);
                    await hl(findlines(['for v in vertices:']));
                    if (dist[i][j] > dist[i][k] + dist[k][j]) {
                        await hl(findlines(['if dist[u][v] > dist[u][k] + dist[k][v]:']), 'rgba(0,255,0,0.33)');
                        await hl(findlines(['dist[u][v] = dist[u][k] + dist[k][v]', 'next[u][v] = k']));
                        const iCol = vertices[i].color;
                        const jCol = vertices[j].color;
                        vertices[i].setColor('lightgreen');
                        vertices[j].setColor('lightgreen');
                        dist[i][j] = dist[i][k] + dist[k][j];
                        path[i][j] = path[i][k].concat(path[k][j].slice(1));
                        fwGrid.buttons[i][j].highlightColor = 'lightgreen';

                        for (let m = 0; m + 1 < path[i][j].length; m++) {
                            const a = vertices[path[i][j][m]];
                            const b = vertices[path[i][j][m + 1]];
                            if (!(await this.messageAnimation(a, b, messageAnimationSpeed / 3))) {
                                this.floydWarshallExit();
                                return;
                            }
                        }
                        fwGrid.setValue(i, j, dist[i][j]);
                        vertices[i].setColor(iCol);
                        vertices[j].setColor(jCol);
                        fwGrid.buttons[i][j].highlightColor = null;
                    }else{
                        await hl(findlines(['if dist[u][v] > dist[u][k] + dist[k][v]:']), 'rgba(255,0,0,0.33)');
                        const iCol = vertices[i].color;
                        const jCol = vertices[j].color;
                        vertices[i].setColor('red');
                        vertices[j].setColor('red');
                        if (!(await this.heartbeat(showVertexSpeed))) {
                            this.floydWarshallExit();
                            return;
                        }
                        vertices[i].setColor(iCol);
                        vertices[j].setColor(jCol);
                    }

                }
            }
            vertices[k].setColor(defaultColor);
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.floydWarshallExit();
                return;
            }
        }

        await hlr([forUIdx[2]]);
        for (let i = 0; i < vertices.length; i++) {
            await hlr([forUIdx[2]]);
            if (dist[i][i] < 0) {
                // Negative cycle detected
                await hl(findlines(['if dist[u][u] < 0:']), 'rgba(0,255,0,0.33)');
                await hl(findlines(['// Negative cycle detected!']));
                vertices[i].setColor('red');
                for (let m = 0; m + 1 < path[i][i].length; m++) {
                    const a = vertices[path[i][i][m]];
                    const b = vertices[path[i][i][m + 1]];
                    b.setColor('red');
                    if (!(await this.messageAnimation(a, b, messageAnimationSpeed))) {
                        this.floydWarshallExit();
                        return;
                    }
                    let edge = edges.find(e => (e.vertexA === a && e.vertexB === b));
                    if (!directedEdges && !edge) {
                        edge = edges.find(e => (e.vertexA === b && e.vertexB === a));
                    }
                    edge.color = 'red';
                }
                   
                await hlr(findlines(['return []']));
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.floydWarshallExit();
                    return;
                }
                await this.heartbeat();
                await sleep(exitSleepDuration);
                while (algorithmPaused) {
                    await sleep(100);
                }
                this.floydWarshallExit();
                return;
            }
        }
    
        await hlr(findlines(['return dist']));
        if (!(await this.heartbeat(showVertexSpeed))) {
            this.floydWarshallExit();
            return;
        }
        await sleep(exitSleepDuration);
        while (algorithmPaused) {
            await sleep(100);
        }
        this.floydWarshallExit();

    }
    async tarjan(){
        algorithmRunning = true;
        for (const v of vertices) {
            v.setSublabel(v.label);
            v.setLabel('-1 | 0');
            v.setColor('black');
        }

        const palette = ['#283378', '#f6e1b3', '#f2769f', '#d6653c', '#b5c99a', 
        '#a3c4f3', '#5f8d3d', '#0a9396'];

        
        const n = vertices.length;
        const idx = new Array(n).fill(-1);
        const low = new Array(n).fill(-1);
        const onStack = new Array(n).fill(false);
        const stack = [];
        let time = 1;
        let sccIdx = 0;

        const findlines = this.findLinesByKeywords.bind(this);
        const hlr = this.highlightAndReset.bind(this);
        const hl = this.highlight.bind(this);
        
        const dfs = async (v) => {
            const vtx = vertices[v];
            vtx.setColor('lightgreen');
            idx[v] = low[v] = time;
            time++;
            stack.push(v);
            onStack[v] = true;

            vtx.setLabel(`${idx[v]} | ${low[v]}`);
            const alwaysBlue = findlines(['dfs(v)', 'tarjanSCC()']);
            await hlr(alwaysBlue);
            await hl(findlines([ ' = time', ' += 1', 'stack.push(v)', 'onStack[v] = true']));
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.tarjanExit();
                return;
            }
            await sleep(100 / animationSpeedFactor);
            const v_neighbors = [];
            for (let edge of edges) {
                let idxA = vertices.indexOf(edge.vertexA);
                let idxB = vertices.indexOf(edge.vertexB);
                if (idxA != v) continue;
                v_neighbors.push({ idx: idxB, edge: edge });
            }
            v_neighbors.sort((a, b) => {
                const w = vertices[a.idx];
                const x = vertices[b.idx];
                return -Math.atan2(w.y - vtx.y, w.x - vtx.x) + Math.atan2(x.y - vtx.y, x.x - vtx.x);
            });
            if (v_neighbors.length === 0) {
                await hlr(alwaysBlue);
                await hl(findlines(['for u in neighbors(v):']), 'rgba(255,0,0,0.33)');
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.tarjanExit();
                    return;
                }
                await sleep(100 / animationSpeedFactor);
            }
            for (let ele of v_neighbors) {
                const u = ele.idx;
                const edge = ele.edge;
                await hlr(findlines(['for u in neighbors(v):']));
                await hl(alwaysBlue);
                if (!(await this.messageAnimation(edge.vertexA, edge.vertexB, messageAnimationSpeed))) {
                    this.tarjanExit();
                    return;
                }
                const prv = vertices[u].color;
                vertices[u].setColor('red');
                if (idx[u] === -1) {
                    // u is not visited
                    await hl(findlines(['if u.arrival == -1:']), 'rgba(0,255,0,0.33)');
                    await hl(findlines(['dfs(u)', '// u is not visited']));
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.tarjanExit();
                        return;
                    }
                    await sleep(100 / animationSpeedFactor)
                    await dfs(u);
                    await hlr(alwaysBlue);
                    await hl(findlines(['if u.arrival == -1:']), 'rgba(0,255,0,0.33)');
                    await hl(findlines(['v.lowlink = min(v.lowlink, u.l', 'for u in', '// u is not visited']));
                    if (!(await this.messageAnimation(edge.vertexA, edge.vertexB, messageAnimationSpeed, true))) {
                        this.tarjanExit();
                        return;
                    }
                    low[v] = Math.min(low[v], low[u]);
                    vtx.setLabel(`${idx[v]} | ${low[v]}`);
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.tarjanExit();
                        return;
                    }
                } else if (onStack[u]) {
                    // u is visited and on stack                    
                    await hl(findlines(['if u.arrival == -1:']), 'rgba(255,0,0,0.33)');
                    await hl(findlines(['else if onStack[u]:']), 'rgba(0,255,0,0.33)');
                    await hl(findlines(['v.lowlink = min(v.lowlink, u.arrival', '// u is visited and on stack']));
                    low[v] = Math.min(low[v], idx[u]);
                    if (!(await this.messageAnimation(edge.vertexA, edge.vertexB, messageAnimationSpeed, true))) {
                        this.tarjanExit();
                        return;
                    }
                    vtx.setLabel(`${idx[v]} | ${low[v]}`);
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.tarjanExit();
                        return;
                    }
                    vertices[u].setColor(prv);
                } else {
                    await hl(findlines(['if u.arrival == -1:']), 'rgba(255,0,0,0.33)');
                    await hl(findlines(['else if onStack[u]:']), 'rgba(255,0,0,0.33)');
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.tarjanExit();
                        return;
                    }
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.tarjanExit();
                        return;
                    }
                    vertices[u].setColor(prv);
                }
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.tarjanExit();
                    return;
                }
            }

            if (low[v] === idx[v]) {
                await hlr(findlines(['if v.lowlink == v.arrival:']), 'rgba(0,255,0,0.33)');
                await hl(alwaysBlue);
                await hl(findlines(['// Found a strongly connected component']));
                await hl(findlines(['scc = []']));
                vertices[v].setColor('red');
                vertices[v].setLabel(`${idx[v]} = ${low[v]}`);
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.tarjanExit();
                    return;
                }
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.tarjanExit();
                    return;
                }
                const scc = [];
                while (true){
                    await hlr(alwaysBlue);
                    await hl(findlines(['while true:', 'u = stack.pop()', 'onStack[u] = false', 'scc.push(u)']));
                    const u = stack.pop();
                    onStack[u] = false;
                    scc.push(u);
                    vertices[u].setColor('red');
                    if(!await this.heartbeat(showVertexSpeed)) {
                        this.tarjanExit();
                        return;
                    }
                    vertices[u].setColor(palette[sccIdx % palette.length]);
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.tarjanExit();
                        return;
                    }
                    if (u === v) {
                        await hlr(alwaysBlue);
                        await hl(findlines(['while true', 'break']));
                        await hl(findlines(['if u == v']), 'rgba(0,255,0,0.33)');
                        if (!(await this.heartbeat(showVertexSpeed))) {
                            this.tarjanExit();
                            return;
                        }
                        await sleep(100 / animationSpeedFactor);
                        sccIdx++;
                        break; // Break when we pop the current vertex
                    }else{
                        await hlr(alwaysBlue);
                        await hl(findlines(['while true']));
                        await hl(findlines(['if u == v']), 'rgba(255,0,0,0.33)');
                        if (!(await this.heartbeat(showVertexSpeed))) {
                            this.tarjanExit();
                            return;
                        }
                        if(!(await this.heartbeat(showVertexSpeed))) {
                            this.tarjanExit();
                            return;
                        }
                    }
                }
                for(let i = 0; i < edges.length; i++) {
                    const edge = edges[i];
                    if (scc.includes(vertices.indexOf(edge.vertexA)) && scc.includes(vertices.indexOf(edge.vertexB))) {
                        edge.setColor(palette[(sccIdx + palette.length - 1) % palette.length]);
                    }
                }
                vertices[v].setLabel(`${idx[v]} | ${low[v]}`);
                await hlr(findlines(['sccs.append(scc)']));
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.tarjanExit();
                    return;
                }
                await sleep(100 / animationSpeedFactor);
                
            }else{
                await hlr(findlines(['if v.lowlink == v.arrival:']), 'rgba(255,0,0,0.33)');
                await hl(alwaysBlue);
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.tarjanExit();
                    return;
                }
                if(!(await this.heartbeat(showVertexSpeed))) {
                    this.tarjanExit();
                    return;
                }
            }
        }
        await hlr(findlines(['tarjanSCC():', 'stack =', 'time =', 'for all ver', 'sccs = []']));
        if (!(await this.heartbeat(showVertexSpeed))) {
            this.tarjanExit();
            return;
        }
        await sleep(150 / animationSpeedFactor);
        for (let i = 0; i < n; i++) {
            await hlr(findlines(['for v in vertices:']));
            if (idx[i] === -1) {
                // Vertex i is not visited
                await hl(findlines(['if v.arrival == -1:']), 'rgba(0,255,0,0.33)');
                await hl(findlines(['dfs(v)']));
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.tarjanExit();
                    return;
                }
                await dfs(i);
                if(!algorithmRunning) {
                    // we quit during dfs
                    return;
                }
            } else {
                await hl(findlines(['if v.arrival == -1:']), 'rgba(255,0,0,0.33)');
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.tarjanExit();
                    return;
                }
            }
        }
        for (let i = 0; i < edges.length; i++){
            if(edges[i].color == edgeDefaultColor) {
                edges[i].color = '#F4F4F4'; // unused
            }
        }
        await hlr(findlines(['return']));
        if (!(await this.heartbeat(showVertexSpeed))) {
            this.tarjanExit();
            return;
        }
        await sleep(exitSleepDuration);
        while (algorithmPaused) {
            await sleep(100);
        }
        this.tarjanExit();
    }


    async edmondsKarp() {
        if (vertices.length === 0) { // don't try
            return; 
        }
        algorithmRunning = true;
        // create a back edge, for any edge that doesn't have one, with capacity zero;
        const addLater = [];
        for (const edge of edges){
            const found = edges.find(e => e.vertexA === edge.vertexB && e.vertexB === edge.vertexA);
            if (!found) {
                addLater.push([edge.vertexB, edge.vertexA]);
            }
        }
        for (const edge of addLater) {
            addEdge(edge[0], edge[1], 0);
        }
        for ( let edge of edges ){
            edge.flowMode = true;
            edge.flow = 0;
            edge.resetLabel();
        }

        const findlines = this.findLinesByKeywords.bind(this);
        const hlr = this.highlightAndReset.bind(this);
        const hl = this.highlight.bind(this);

        const whilevIdx = findlines(['while v']).sort((a, b) => a - b);
        const ueqIdx = findlines(['u = parent[v]']).sort((a, b) => a - b);
        const vequIIdx = findlines(['v = u']).sort((a, b) => a - b);
        const veqsinkIdx = findlines(['v = sink']).sort((a, b) => a - b);

        const source = sourceVertex ? sourceVertex : vertices[0];
        const sink = sinkVertex ? sinkVertex : vertices[vertices.length - 1];
        await hlr(findlines(['edmond']));
        if (source === sink){
            await hl(findlines(['if source == sink:']), 'rgba(0, 255, 0, 0.33)');
            await hl(findlines(['return ∞']));
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.edmondsKarpExit();
                return;
            }
            await sleep(exitSleepDuration);
            while (algorithmPaused) {
                await sleep(100);
            }
            this.edmondsKarpExit();
            return;
        } else {
            await hl(findlines(['if source == sink:']), 'rgba(255, 0, 0, 0.33)');
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.edmondsKarpExit();
                return;
            }
            await sleep(100 / animationSpeedFactor);
        }

        await hlr(findlines(['edmond']));
        await hl(findlines(['maxflow = 0']));
        for (let i = 0; i < vertices.length; i++) {
            vertices[i].setSublabel(vertices[i].label);
            vertices[i].setLabel(negativeInfinityStr);
            vertices[i].setColor('black');
        }
        source.setLabel(infinityStr);
        sink.setLabel('0');

        if (!(await this.heartbeat(showVertexSpeed))) {
            this.edmondsKarpExit();
            return;
        }

        await sleep(150 / animationSpeedFactor);
        let totalFlow = 0;
        while (true){
            await hlr(findlines(['while true:']));
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.edmondsKarpExit();
                return;
            }
            await hl(findlines(['parent[v] = -1', 'parent[source]', 'Q.push(s']));
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.edmondsKarpExit();
                return;
            }
            sink.setLabel('∞');
            await sleep(150 / animationSpeedFactor);
            const parent = new Array(vertices.length).fill(-1);
            parent[vertices.indexOf(source)] = -2; // source has no parent
            const maxFlowTo = new Array(vertices.length).fill(Infinity);
            const Q = [source];
            source.setColor(unweightedFancyBlue);
            while (Q.length > 0 && parent[vertices.indexOf(sink)] === -1) {
                await hlr(findlines(['while Q is not empty', 'while true']));
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.edmondsKarpExit();
                    return;
                }
                const u = Q.shift();
                const prevColor = u.color;
                u.setColor('lightgreen');
                await hl(findlines(['u = Q.pop()']));
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.edmondsKarpExit();
                    return;
                }
                await sleep(100 / animationSpeedFactor);
                const u_neighbors = [];
                for (let edge of edges) {
                    let idxA = vertices.indexOf(edge.vertexA);
                    let idxB = vertices.indexOf(edge.vertexB);
                    if (idxA != vertices.indexOf(u)) continue;
                    u_neighbors.push({ idx: idxB, edge: edge });
                }
                u_neighbors.sort((a, b) => {
                    const w = vertices[a.idx];
                    const x = vertices[b.idx];
                    return -Math.atan2(w.y - u.y, w.x - u.x) + Math.atan2(x.y - u.y, x.x - u.x);
                });
                
                await hlr(findlines(['while Q is not empty', 'while true']));
                if (u_neighbors.length === 0) {
                    await hl(findlines(['for (v, flow, cap) in neighbors(u):']), 'rgba(255,0,0,0.33)');
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.edmondsKarpExit();
                        return;
                    }
                    await sleep(100 / animationSpeedFactor);
                }else{
                    await hl(findlines(['for (v, flow, cap) in neighbors(u):']));
                    if (!(await this.heartbeat(showVertexSpeed))) {
                        this.edmondsKarpExit();
                        return;
                    }
                    for (let ele of u_neighbors) {
                        const v = ele.idx;
                        const edge = ele.edge;
                        await hlr(findlines(['for (v, flow, cap) in neighbors(u):', 'while Q is not empty', 'while true']));
                        if (!(await this.messageAnimation(edge.vertexA, edge.vertexB, messageAnimationSpeed))) {
                            this.edmondsKarpExit();
                            return;
                        }
                        let vPrevColor = vertices[v].color;
                        vertices[v].setColor('red');
                        if (! (await this.heartbeat(showVertexSpeed))) {
                            this.edmondsKarpExit();
                            return;
                        }
                        if (parent[v] === -1 && edge.weight - edge.flow > 0) {
                            await hl(findlines(['if parent[v] == -1 and cap - flow > 0:']), 'rgba(0,255,0,0.33)');
                            await hl(findlines(['parent[v] = u', 'Q.push(v)']));
                            if (!(await this.heartbeat(showVertexSpeed))) {
                                this.edmondsKarpExit();
                                return;
                            }
                            parent[v] = vertices.indexOf(u);
                            Q.push(vertices[v]);
                            vPrevColor = unweightedFancyBlue;
                            maxFlowTo[v] = Math.min(maxFlowTo[vertices.indexOf(u)], edge.weight - edge.flow);
                            vertices[v].setLabel(maxFlowTo[v].toString());
                        }else{
                            await hl(findlines(['if parent[v] == -1 and cap - flow > 0:']), 'rgba(255,0,0,0.33)');
                            if (!(await this.heartbeat(showVertexSpeed))) {
                                this.edmondsKarpExit();
                                return;
                            }
                            if (!(await this.heartbeat(showVertexSpeed))) {
                                this.edmondsKarpExit();
                                return;
                            }
                        }
                        vertices[v].setColor(vPrevColor);
                        if (!(await this.heartbeat(showVertexSpeed))) {
                            this.edmondsKarpExit();
                            return;
                        }
                    }
                    
                }
                u.setColor(prevColor);
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.edmondsKarpExit();
                    return;
                }

            }

            await hlr(findlines(['while true']));
            if(parent[vertices.indexOf(sink)] === -1) {
                // no augmenting path
                await hl(findlines(['if parent[sink] == -1:']), 'rgba(0,255,0,0.33)');
                await hl(findlines(['break']));
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.edmondsKarpExit();
                    return;
                }
                await sleep(100 / animationSpeedFactor);
                break;
            }
            await hl(findlines(['if parent[sink] == -1:']), 'rgba(255,0,0,0.33)');
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.edmondsKarpExit();
                return;
            }
            await sleep(100 / animationSpeedFactor);

            await hl(findlines(['// walk back to get the path capacity']));
            await hl(findlines(['pathCap = ∞']));
            await hl([veqsinkIdx[0]]);

            if (!(await this.heartbeat(showVertexSpeed))) {
                this.edmondsKarpExit();
                return;
            }
            await sleep(100 / animationSpeedFactor);

            await hlr(findlines(['while true']));
            await hl([whilevIdx[0]]);
            let v = vertices.indexOf(sink);
            while (v !== vertices.indexOf(source)) {
                const u = parent[v];
                await hlr(findlines(['while true']));
                await hl([whilevIdx[0]]);
                await hl([ueqIdx[0]]);
                if(!(await this.messageAnimation(vertices[u], vertices[v], messageAnimationSpeed, true))) {
                    this.edmondsKarpExit();
                    return;
                }
                const foundEdge = edges.find(e => {
                    return (e.vertexA === vertices[u] && e.vertexB === vertices[v])
                }
                );
                foundEdge.color = fancyBlue;
                if(maxFlowTo[v] === maxFlowTo[u]) {
                    // if statement not accepted
                    await hl(findlines(['if cap(u,v) - flow(u,v) < pathCap:']), 'rgba(255,0,0,0.33)');
                }else{
                    await hl(findlines(['if cap(u,v) - flow(u,v) < pathCap:']), 'rgba(0,255,0,0.33)');
                    await hl(findlines(['pathCap = cap(u,v) - flow(u,v)']));
                }
                if (!(await this.heartbeat(showVertexSpeed))) {
                    this.edmondsKarpExit();
                    return;
                }
                await sleep(100 / animationSpeedFactor);
                v = u;
            }

            
            await hlr(findlines(['while true']));
            await hl([whilevIdx[0]]);
            await hl([vequIIdx[0]]);

            if (!(await this.heartbeat(showVertexSpeed))) {
                this.edmondsKarpExit();
                return;
            }
            await sleep(100 / animationSpeedFactor);

        

            await hlr(findlines(['while true']));
            await hl(findlines(['// update the flow along the path']));
            await hl([veqsinkIdx[1]]);
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.edmondsKarpExit();
                return;
            }
            await sleep(100 / animationSpeedFactor);

            await hlr(findlines(['while true']));
            await hl([whilevIdx[1]]);
            v = vertices.indexOf(sink);
            const resetColorEdges = [];
            while (v !== vertices.indexOf(source)) {
                const u = parent[v];
                await hlr(findlines(['while true']));
                await hl([whilevIdx[1]]);
                await hl([ueqIdx[1]]);
                if (!(await this.messageAnimation(vertices[u], vertices[v], messageAnimationSpeed, true))) {
                    this.edmondsKarpExit();
                    return;
                }
                await hlr(findlines(['while true']));
                await hl([whilevIdx[1]]);
                await hl(findlines([' flow(u, v) += pathCap','flow(v, u) -= pathCap']));    
                const foundEdge = edges.find(e => {
                    return (e.vertexA === vertices[u] && e.vertexB === vertices[v])
                });
                foundEdge.flow += maxFlowTo[vertices.indexOf(sink)];
                foundEdge.resetLabel();
                foundEdge.color = 'lightgreen';
                foundEdge.textColor = 'lightgreen';
                const backEdge = edges.find(e => {
                    return (e.vertexA === vertices[v] && e.vertexB === vertices[u])
                });
                backEdge.flow -= maxFlowTo[vertices.indexOf(sink)];
                backEdge.resetLabel();
                backEdge.textColor = 'red';
                if (!await this.heartbeat(showVertexSpeed)) {
                    this.edmondsKarpExit();
                    return;
                }
                
                await hlr(findlines(['while true']));
                await hl([whilevIdx[1]]);
                await hl([vequIIdx[1]]);
                await sleep(100 / animationSpeedFactor);
                resetColorEdges.push(foundEdge);
                resetColorEdges.push(backEdge);

                v = u;
            }
            if (!(await this.heartbeat(showVertexSpeed))) {
                this.edmondsKarpExit();
                return;
            }
            await sleep(150 / animationSpeedFactor);
            for (let edge of resetColorEdges) {
                edge.resetColor();
            }
            totalFlow += maxFlowTo[vertices.indexOf(sink)]; 
            for (let vtx of vertices) {
                vtx.setLabel(negativeInfinityStr);
                vtx.setColor('black');
            }
            sink.setLabel(totalFlow.toString());
            source.setLabel(infinityStr);
            source.setColor(unweightedFancyBlue);

            await hlr(findlines(['maxFlow += pathCap']));
            await hl(findlines(['while true']));

            if (!(await this.heartbeat(showVertexSpeed))) {
                this.edmondsKarpExit();
                return;
            }
            await sleep(150 / animationSpeedFactor);
        }
        await hlr(findlines(['return maxFlow']));
        for(let vtx of vertices) {
            vtx.setLabel('');
        }
        sink.setLabel(totalFlow.toString());
        for (let edge of edges) {
            if(edge.flow > 0){
                edge.color = 'lightgreen';
            }
        }
        if (!(await this.heartbeat(showVertexSpeed))) {
            this.edmondsKarpExit();
            return;
        }
        await sleep(exitSleepDuration);
        while (algorithmPaused) {
            await sleep(100);
        }
        this.edmondsKarpExit();
        
    }
}
const dijkstraCode = `dijkstra(source):
    dist[v] = ∞ for all vertices v
    dist[source] = 0
    PQ.push(source, with distance 0)
    while PQ is not empty:
        (u, dist_u) = PQ.extractMinDistance() 
        for (v, weight) in neighbors(u):
            if dist[v] > dist_u + weight:
                dist[v] = dist_u + weight
                PQ.decreaseKey(v, dist[v])
    return dist
`;

const bfsCode = `bfs(source):
    dist[v] = ∞ for all vertices v
    dist[source] = 0
    Q.push(source)
    while Q is not empty:
        u = Q.pop()
        for v in neighbors(u):
            if dist[v] == ∞:
                dist[v] = dist[u] + 1
                Q.push(v)
    return dist
`;

const twoColorCode = `twoColor(source):
    color[source] = 0
    Q.push(source)
    while Q is not empty:
        u = Q.pop()
        for v in neighbors(u):
            if color[v] == -1:
                // color v the opposite color
                color[v] = 1 - color[u] 
                Q.push(v)
            else if color[v] == color[u]:
                return false // Not bipartite
    return true // Bipartite

twoColorInit():
    color[v] = -1 for all vertices v
    for v in vertices:
        if color[v] == -1:
            if not twoColor(v):
                return false
    return true
`;

const dfsCode = `dfs(vertex):
    visited[vertex] = true
    for neighbor in neighbors(vertex):
        if not visited[neighbor]:
            dist[neighbor] = dist[vertex] + 1
            dfs(neighbor)

dfsInit(source):
    visited[v] = false for all vertices v
    dist[v] = ∞ for all vertices v
    dist[source] = 0
    dfs(source)
    return dist
`;

const bellmanFordCode = `bellmanFord(source):
    dist[v] = ∞ for all vertices v
    dist[source] = 0

    // Relax all edges up to |V| - 1 times
    for i from 1 to |V| - 1:
        anyUpdates = false
        for (u, v, weight) in edges:
            if dist[u] + weight < dist[v]:
                dist[v] = dist[u] + weight
                anyUpdates = true
        if not anyUpdates:
            break

    // Check for negative cycles, and propagate -∞
    queue Q;
    for (u, v, weight) in edges:
        if dist[u] + weight < dist[v]:
            dist[v] = -∞ // Negative cycle found!
            Q.push(v)
    while Q is not empty:
        v = Q.pop()
        for neighbor in neighbors(v):
            if dist[neighbor] != -∞:
                dist[neighbor] = -∞
    return dist
`;

const primsMSTCode = `primsMST(source):
    dist[v] = ∞ for all vertices v
    parent[v] = None for all vertices v
    dist[source] = 0
    PQ.push(source, with distance 0)
    while PQ is not empty:
        (u, dist_u) = PQ.extractMinDistance()
        if parent[u] is not None:
            add edge (parent[u], u) to MST
        for (v, weight) in neighbors(u):
            if dist[v] > weight:
                dist[v] = weight
                parent[v] = u
                PQ.decreaseKey(v, dist[v])
    return MST
`;

const kruskalsMSTCode = `kruskalsMST():
    edges.sort(by weight)
    for edge (u, v, w) in edges:
        if u and v in different components:
            add edge (u, v) to MST
            union(u, v) // Merge components
    return MST
`;

const toposortCode = `topologicalSort():
    in_degree[v] = 0 for all vertices v
    for (u, v) in edges:
        in_degree[v] += 1
    
    for v in vertices:
        if in_degree[v] == 0:
            Q.push(v)
    
    sorted = []
    while Q is not empty:
        u = Q.pop()
        sorted.append(u)
        for v in neighbors(u):
            in_degree[v] -= 1
            if in_degree[v] == 0:
                Q.push(v)

    if len(sorted) != |V|:
        // Cycle detected!
        return []
    else:
        return sorted
`;
const floydWarshallCode = `floydWarshall():
   dist[u][v] = ∞ for all vertices u, v
   for u in vertices:
      dist[u][u] = 0
      for (v,w) in neighbors(u):
         dist[u][v] = w

   for k in vertices:
      for u in vertices:
         for v in vertices:
            if dist[u][v] > dist[u][k] + dist[k][v]:
               dist[u][v] = dist[u][k] + dist[k][v]

   for u in vertices:
      if dist[u][u] < 0:
         // Negative cycle detected!
         return []

   return dist
`;

const tarjanCode = `dfs(v):
    v.arrival = time;
    v.lowlink = time;
    time += 1;
    stack.push(v);
    onStack[v] = true;
    for u in neighbors(v):
        if u.arrival == -1:
             // u is not visited
            dfs(u);
            v.lowlink = min(v.lowlink, u.lowlink);
        else if onStack[u]:
            // u is visited and on stack
            v.lowlink = min(v.lowlink, u.arrival);

    if v.lowlink == v.arrival:
        // Found a strongly connected component
        scc = []
        while true:
            u = stack.pop();
            onStack[u] = false;
            scc.push(u);
            if u == v:
                break;
        sccs.append(scc);

tarjanSCC():
    time = 1;
    stack = [];
    onStack[v] = false for all vertices v;
    v.arrival = -1 for all vertices v;
    sccs = [];
    for v in vertices:
        if v.arrival == -1:
            dfs(v);
    return sccs;
    
`
const edmondsKarpCode = `edmondsKarp(source, sink):
   if source == sink:
      return ∞
   maxFlow = 0
   while true:
      parent[v] = -1 for all vertices v
      parent[source] = source
      Q.push(source)
      while Q is not empty and parent[sink] == -1:
         u = Q.pop()
         for (v, flow, cap) in neighbors(u):
            if parent[v] == -1 and cap - flow > 0:
               parent[v] = u
               Q.push(v)

      if parent[sink] == -1:
         // no augmenting path
         break  

      // walk back to get the path capacity          
      pathCap = ∞
      v = sink
      while v != source:   
         u = parent[v]
         if cap(u,v) - flow(u,v) < pathCap:
            pathCap = cap(u,v) - flow(u,v)
         v = u
      
      // update the flow along the path   
      v = sink
      while v != source:  
         u = parent[v]
         flow(u, v) += pathCap
         flow(v, u) -= pathCap
         v = u
      maxFlow += pathCap
   return maxFlow
`


    


async function startAlgorithm(executor) {
    if (algorithmRunning) return;     
    if (mode == Mode.TYPING || mode == Mode.SELECT_SOURCE){
        return;
    }      
    if (typeof executor !== 'function') return;

    const prevMode  = mode;
    mode = Mode.RUN_ALGORITHM;
    resetMode();
    algorithmTerminated = false;
    algorithmPaused = false;
    pausedDuration = 0;

    try {
        await executor(); 
    } catch (err) {
        console.error('Algorithm crashed:', err);
    } finally {
        mode = prevMode;
        resetMode();
    }
}

const defaultMenuFont = '16px Inter, sans-serif';
class Menu{
    constructor(width, height, x, y, bordered=true){
        this.width = width;
        this.height = height;
        this.x = x;
        this.y = y;
        this.bordered = bordered;
        this.items = [];
    }
    addItem(item){
        if(item.width > this.width){
            console.error('Menu item is too wide');
            return;
        }
        let prevY = this.items.reduce((acc, item) => acc + item.height, 0);
        if(prevY + item.height > this.height){
            console.error('Menu is full');
            return
        }
        prevY += this.y;
        item.x = this.x;
        item.y = prevY;        
        this.items.push(item);
    }
    draw(context) {
        if (this.bordered) {
            context.lineWidth = 1;
            context.strokeStyle = 'black';
            context.stroke();
        }
        this.items.forEach(item => item.draw(context));
    }
};

class TextButton{
    // Highlight color is intended to have a mid-low alpha channel;
    // it will still work otherwise but might interfere with other elements
    constructor(text, width, height, x, y, onClick=null, justify='left',font=defaultMenuFont, highlightColor=null, borderWidth=0, textColor='black'){
        this.text = text;
        this.width = width;
        this.height = height;
        this.x = x;
        this.y = y;
        this.onClick = onClick;
        this.justify = justify;
        this.font = font;
        this.highlightColor = highlightColor;
        this.borderWidth = borderWidth;
        this.textColor = textColor;
        this.disabled = false;
        this.highlightGreenUntil = performance.now() - 1000;
    }
    draw(context){
        // draw the border
        if(this.borderWidth > 0) {
            context.beginPath();
            context.rect(this.x, this.y, this.width, this.height);
            context.fillStyle = 'black';
            context.lineWidth = this.borderWidth;
            context.strokeStyle = 'black';
            context.stroke();
            context.closePath();
        }

        const prevHighlightColor = this.highlightColor;
        if (performance.now() < this.highlightGreenUntil) {
            this.highlightColor = 'rgba(0, 255, 0, 0.3)'; // highlight green
        }

        // highlight the button if it has a highlight color
        if(this.highlightColor){
            context.beginPath();
            context.rect(this.x + this.borderWidth, this.y + this.borderWidth, this.width - 2 * this.borderWidth, this.height - 2 * this.borderWidth);
            context.fillStyle = this.highlightColor;
            context.fill();
        }

        this.highlightColor = prevHighlightColor; // reset highlight color

        // draw the label
        context.font = this.font;
        context.textAlign = this.justify;
        context.textBaseline = 'middle';
        context.fillStyle = this.textColor;
        if(this.justify == 'left'){
            context.fillText(this.text, this.x + 5, this.y + this.height / 2);
        }else if(this.justify == 'right'){
            context.fillText(this.text, this.x + this.width - 5, this.y + this.height / 2);
        }else if(this.justify == 'center'){
            context.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2);
        } // else idk do nothing
    }
    disable() { this.disabled = true; }
    enable() { this.disabled = false; }
    inBounds(x, y){
        if(this.disabled) return false;
        return x >= this.x && x <= this.x + this.width && y >= this.y && y <= this.y + this.height;
    }
    async click(){
        if(this.onClick){
            this.highlightGreenUntil = performance.now() + 175; // highlight green for 1 second
            this.onClick();
            await sleep(175); 
        }
    }
}



class CodeBlock extends Menu {
    constructor(width, height, x, y, bordered=false) {
        super(width, height, x, y, bordered);
        this.lineButtons = [];
        this.lineH = codeBlockFontSize + 2; // vertical padding
    }

    
    load(lines, font = codeBlockFont) {
        this.items.length  = 0; // clear menu items
        this.lineButtons   = [];
        lines.forEach((ln, i) => {
            const btn = new TextButton(
                ln, this.width, this.lineH,
                this.x, this.y + i * this.lineH,
                null, 'left', font,
                null, 0, 'black'
            );
            btn.disable();
            this.addItem(btn);
            this.lineButtons.push(btn);
        });
    }

    
    highlight(idxs, color = 'rgba(255,215,0,0.35)') {
        idxs.forEach(i => {
            const b = this.lineButtons[i];
            if (b) b.highlightColor = color;
        });
    }
    clearHighlight() {
        this.lineButtons.forEach(b => b.highlightColor = null);
    }

    
    colorText(idxs, color = 'red') {
        idxs.forEach(i => {
            const b = this.lineButtons[i];
            if (b) b.textColor = color;
        });
    }
    clearColorText() {
        this.lineButtons.forEach(b => b.textColor = 'black');
    }
}

const fwBlockSize = 32;
class FloydWarshallGrid extends Menu { 
    constructor(x, y, N) {
        const width = N * fwBlockSize;
        const height = N * fwBlockSize;
        super(width, height, x, y, false);
        this.N = N;
        this.grid = Array.from({ length: N }, () => Array(N).fill(infinityStr));
        this.buttons = [];
        for (let i = 0; i < N; i++) {
            this.buttons[i] = [];
            for (let j = 0; j < N; j++) {
                const btn = new TextButton(
                    '', fwBlockSize, fwBlockSize,
                    x + j * fwBlockSize, y + i * fwBlockSize, 
                    null, 'center', '16px Inter, sans-serif',
                    null, 1, 'black'
                );
                this.items.push(btn); // bypass addItem to avoid issues with width
                this.buttons[i][j] = btn;
            }
        }
    }
    setValue(i, j, value) {
        if (i < 0 || i >= this.N || j < 0 || j >= this.N) return;
        this.grid[i][j] = value;
        this.buttons[i][j].text = value;
    }
    getValue(i, j) {
        if (i < 0 || i >= this.N || j < 0 || j >= this.N) return null;
        return this.grid[i][j];
    }
    clear() {
        for (let i = 0; i < this.N; i++) {
            for (let j = 0; j < this.N; j++) {
                this.setValue(i, j, '');
            }
        }
    }
    init() {
        for (let i = 0; i < this.N; i++) {
            for (let j = 0; j < this.N; j++) {
                this.setValue(i, j, infinityStr);
            }
        }
    }
};

let fwGrid = null;

function loadFWGrid(){
    if (fwGrid && fwGrid.N == vertices.length) {
        // just make sure it's in menus
        if (!menus.includes(fwGrid)) {
            menus.push(fwGrid);
        }
        return;
    }
    if (fwGrid && menus.includes(fwGrid)) {
        menus.splice(menus.indexOf(fwGrid), 1); // remove old grid
    }
    fwGrid = new FloydWarshallGrid(codeViewX, codeViewY + 350, vertices.length);
    menus.push(fwGrid);
}
function unloadFWGrid() {
    if (fwGrid && menus.includes(fwGrid)) { 
        menus.splice(menus.indexOf(fwGrid), 1);
        fwGrid = null;
    }
}



const codeView = new CodeBlock(
    codeViewWidth, codeViewHeight,
    codeViewX, codeViewY,
    0
);
codeView.load(dijkstraCode.split('\n'));
menus.push(codeView);

const alg = new Algorithm(codeView);


const toposortMenuX = codeViewX + 10;
const toposortMenuY = codeViewY + 450;
const toposortMenu = new TextButton(
    '', codeViewWidth, 30,
    toposortMenuX, toposortMenuY,
    null, 'left', '24px Inter, sans-serif',
    null, 0, 'black'
);    
const toposortMenuCtnr = new Menu(
    codeViewWidth, 30,
    toposortMenuX, toposortMenuY,
    false
);
toposortMenuCtnr.addItem(toposortMenu);
function loadToposortMenu() {
    if (menus.includes(toposortMenuCtnr)) return; // already loaded
    menus.push(toposortMenuCtnr);
}
function unloadToposortMenu() {
    if(!menus.includes(toposortMenuCtnr)) return; // already unloaded
    menus.splice(menus.indexOf(toposortMenuCtnr), 1);
    toposortMenu.text = ''; // clear text
}


/*
class ImageButton{
    constructor(image, width, height, x, y, onClick=null, highlightColor=null, borderWidth=0){
        this.image = image;
        this.width = width;
        this.height = height;
        this.x = x;
        this.y = y;
        this.onClick = onClick;
        this.highlightColor = highlightColor;
        this.borderWidth = borderWidth;
    }
    draw(context){
        // draw the border
        context.beginPath();
        context.rect(this.x, this.y, this.width, this.height);
        context.fillStyle = 'black';
        context.lineWidth = this.borderWidth;
        context.strokeStyle = 'black';
        context.stroke();
        context.closePath();

        // highlight the button if it has a highlight color
        if(this.highlightColor){
            context.beginPath();
            context.rect(this.x + this.borderWidth, this.y + this.borderWidth, this.width - 2 * this.borderWidth, this.height - 2 * this.borderWidth);
            context.fillStyle = this.highlightColor;
            context.fill();
        }

        // draw the label
        context.drawImage(this.image, this.x, this.y, this.width, this.height);
    }
    inBounds(x, y){
        return x >= this.x && x <= this.x + this.width && y >= this.y && y <= this.y + this.height;
    }
    async click(){
        if(this.onClick){
            const tmp = this.highlightColor;
            this.highlightColor = 'rgba(0, 255, 0, 0.3)'; // highlight on click
            this.onClick();
            await sleep(175);
        }
    }
}*/


class RPButton extends TextButton {
    constructor(x, y, size, onClick) {
        super('R', size, size, x, y, onClick, 'center',
              defaultMenuFont, paletteMenuHighlightColor, paletteButtonBorderWidth);
    }
    draw(ctx) {
        this.text = algorithmRunning ? (algorithmPaused ? 'R' : 'P') : 'R';
        super.draw(ctx);
    }
}



const paletteMenuColumnA = new Menu(paletteButtonWidth,
                                    paletteMenuHeight,
                                    paletteMenuX,
                                    paletteMenuY,
                                    false);   // no border

const paletteMenuColumnB = new Menu(paletteButtonWidth,
                                    paletteMenuHeight,
                                    paletteMenuX + paletteButtonWidth + paletteMenuButtonGap,
                                    paletteMenuY,
                                    false);

const paletteMenu = [paletteMenuColumnA, paletteMenuColumnB];
menus.push(...paletteMenu);  // single source of truth
function makepaletteMenuButton(label, row, col, onClick, highlight=paletteMenuHighlightColor) {
    const menu  = paletteMenu[col];
    const xPos  = menu.x;
    const yPos  = menu.y + row * (paletteButtonWidth + paletteMenuButtonGap);

    const btn = new TextButton(label,
                               paletteButtonWidth,
                               paletteButtonWidth,
                               xPos,
                               yPos,
                               onClick,
                               'center',
                               defaultMenuFont,
                               highlight,
                               paletteButtonBorderWidth)
    menu.addItem(btn);
    return btn;
}

//  helper to create an onClick that swaps editing mode
const modeSetter = target =>
    () => {                        
        if (algorithmRunning || mode === target) return;
        mode = target;
        resetMode();
    };

makepaletteMenuButton('V', 0, 0, modeSetter(Mode.ADD_VERTEX))
makepaletteMenuButton('X', 0, 1, modeSetter(Mode.DEL_VERTEX));

makepaletteMenuButton('E', 1, 0, modeSetter(Mode.ADD_EDGE));
makepaletteMenuButton('Q', 1, 1, modeSetter(Mode.DEL_EDGE));

makepaletteMenuButton('M', 2, 0, modeSetter(Mode.MOVE_VERTEX));
makepaletteMenuButton('H', 2, 1, () => {showHintMenu = !showHintMenu; });


function makeRunPauseButton() {
    const row = 3;
    const menu = paletteMenu[0];
    const xPos = menu.x;
    const yPos = menu.y + row * (paletteButtonWidth + paletteMenuButtonGap);

    const btn = new RPButton(xPos, yPos, paletteButtonWidth,
                             async () => {
                                if (mode == Mode.SELECT_SOURCE){
                                    mode = selectSourcePreviousMode;
                                    resetMode();
                                }
                                 if (algorithmRunning) {
                                     algorithmPaused = !algorithmPaused;
                                 } else {
                                    await startAlgorithm(async () => {
                                        if (vertices.length == 0) return;
                                        const source = sourceVertex || vertices[0];
                                        algorithmExecutor(source);
                                    });
                                 }
                             });
                             
    menu.addItem(btn);
}
makeRunPauseButton();
function makeStopButton() {
    const row = 3;
    const menu = paletteMenu[1];
    const xPos = menu.x;
    const yPos = menu.y + row * (paletteButtonWidth + paletteMenuButtonGap);

    const btn = new TextButton('Esc', paletteButtonWidth, paletteButtonWidth,
                               xPos, yPos,
                               () => {
                                   if (algorithmRunning) {
                                       algorithmTerminated = true;
                                   }
                                   if (mode == Mode.SELECT_SOURCE){
                                        mode = selectSourcePreviousMode;
                                        resetMode();
                                   }
                               },
                                 'center',
                                 defaultMenuFont,
                                 paletteMenuHighlightColor,
                                 paletteButtonBorderWidth);
    menu.addItem(btn);
}
makeStopButton();


    
class AnimationSpeedSlider {
    constructor(x, y, width, height, min=0.25,max=2.0){
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.min = min;
        this.max = max;
        this.value = 0.5; // default value
        animationSpeedFactor = this.value; // set the global animation speed factor
    }
    draw(context) {
        // draw a line in the center, then a rectangle with width 5 and height height - 5 centered on the line at the correct location
        context.beginPath();
        context.moveTo(this.x, this.y + this.height / 2);
        context.lineTo(this.x + this.width, this.y + this.height / 2);
        context.lineWidth = 2;
        context.strokeStyle = 'black';
        context.stroke();
        context.closePath();
        const sliderX = this.x + (this.value - this.min) / (this.max - this.min) * this.width;
        context.fillStyle = 'rgba(185, 185, 185, 1)';
        context.fillRect(sliderX - 2.5, this.y + 2.5, 5, this.height - 5);
    }
    inBoundsSlider(x, y) {
        return x >= this.x && x <= this.x + this.width && y >= this.y && y <= this.y + this.height;
    }
    async clickSlider(x, y) {
        this.value = this.min + (x - this.x) / this.width * (this.max - this.min);
        if (this.value < this.min) {
            this.value = this.min;
        }
        if (this.value > this.max) {
            this.value = this.max;
        }
        animationSpeedFactor = this.value;
        requestAnimationFrame(() => draw());
    }
    inBounds(x, y) { return false; }
    click(){}
}
const animationSlideMenu = new Menu(
    animationSliderWidth, animationSliderHeight + 60,
    animationSliderX, animationSliderY, 
    false); // no border
animationSlideMenu.addItem(new AnimationSpeedSlider(
    animationSliderX, animationSliderY,
    animationSliderWidth, animationSliderHeight
));
animationSlideMenu.addItem(new TextButton(
    'Animation Speed (Low/High)', animationSliderWidth, 20,
    animationSliderX - 5, animationSliderY + animationSliderHeight + 5,
    null, 'center', '10px Inter, sans-serif',
    null, 0, 'black'
));
menus.push(animationSlideMenu);


const checkboxFont = '10px Inter, sans-serif';
const checkboxSize = 12;
class DirectedCheckbox extends TextButton {
    // onClick must accept a boolean that tells it what to do
    // whether the box is checked or not
    constructor(){
        super((directedEdges ? 'x' : ' '), checkboxSize, checkboxSize,
            animationSliderX - checkboxSize - 8, animationSliderY + 3,
            () => {
                convertEdges(!directedEdges); // has side effect don't change again
                this.label = directedEdges ? 'x' : ' ';
            }, 'center', 'bold 18px Montserrat, sans-serif',
            null, 1, 'black');
        }
    draw(context) {
        this.text = directedEdges ? 'x' : ' ';
        super.draw(context);

    }
} 
const directedCheckboxMenu = new Menu(
    checkboxSize + 5, animationSliderHeight + 60,
    animationSliderX - checkboxSize - 60, animationSliderY + 3,
    false // no border
);
directedCheckboxMenu.addItem(new DirectedCheckbox());
directedCheckboxMenu.addItem(new TextButton(
    'Directed Edges', checkboxSize + 5, 20,
    animationSliderX - checkboxSize - 60, animationSliderY + animationSliderHeight + 5,
    null, 'center', checkboxFont,
    null, 0, 'black'
));
menus.push(directedCheckboxMenu); 

function loadDirectedCheckbox() {
    // find checkboox
    const checkbox = menus.find(menu => menu.items.some(item => item instanceof DirectedCheckbox));
    if (checkbox){
        // pass; already there
    }else{
        menus.push(directedCheckboxMenu);
        requestAnimationFrame(() => draw());
    }
}
function unloadDirectedCheckbox() {
    // find checkboox
    const checkbox = menus.find(menu => menu.items.some(item => item instanceof DirectedCheckbox));
    if (checkbox){
        menus.splice(menus.indexOf(checkbox), 1);
        requestAnimationFrame(() => draw());
    }else{
        // pass; already gone
    }
}

class HorizontalMenu extends Menu {
    constructor(width, height, x, y,
                bg = '#0d47a1',           // royal / navy-ish blue
                gap = 20,                 // space between buttons
                bordered = false) {
        super(width, height, x, y, bordered);
        this.bg   = bg;
        this.gap  = gap;
    }
    addItem(item) {
        const used = this.items.reduce((acc, it) => acc + it.width + this.gap, 0) + this.gap;
        if (used + item.width > this.width) { console.error('Menu full'); return; }
        item.x = this.x + used;
        item.y = this.y + (this.height - item.height) / 2;   // vertically centre
        this.items.push(item);
    }
    draw(ctx) {
        ctx.fillStyle = this.bg;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        this.items.forEach(it => it.draw(ctx));
    }
}
function makeHeaderOnclick(name){
    return () => {
        if (algorithmRunning) return; // don't change algorithm while running
        if (currentAlgorithm === name) return; // don't change if already selected
        unloadAlgorithm(currentAlgorithm);
        loadAlgorithm(name);
        currentAlgorithm = name;
    }
}
function makeHeaderButton(label, onClick = null) {
    const font = 'small-caps 14px Open Sans, sans-serif';
    ctx.font = font;
    const pad = 16;  // horizontal padding
    const w = ctx.measureText(label).width + pad;
    return new TextButton(label.toUpperCase(), w, 32,     // 32-px high bar
                          0, 0,                           // x,y set by addItem()
                          onClick, 'left', font,
                          null, 0, 'white');
}


let headerMenu = new HorizontalMenu(canvas.width, 32, 0, 0); 


headerMenu.addItem(makeHeaderButton('BFS', makeHeaderOnclick('bfs')));
headerMenu.addItem(makeHeaderButton('DFS', makeHeaderOnclick('dfs')));
headerMenu.addItem(makeHeaderButton('2COLORING', makeHeaderOnclick('2coloring')));
headerMenu.addItem(makeHeaderButton("DIJKSTRA'S", makeHeaderOnclick('dijkstra')));
headerMenu.addItem(makeHeaderButton('BELLMAN-FORD', makeHeaderOnclick('bellmanford')));
headerMenu.addItem(makeHeaderButton("PRIM'S MST", makeHeaderOnclick('prims')));
headerMenu.addItem(makeHeaderButton("KRUSKAL'S MST", makeHeaderOnclick('kruskals')));
headerMenu.addItem(makeHeaderButton("KAHN'S TOPOSORT", makeHeaderOnclick('toposort')));
headerMenu.addItem(makeHeaderButton('FLOYD-WARSHALL', makeHeaderOnclick('floydwarshall')));
headerMenu.addItem(makeHeaderButton("TARJAN'S SCC", makeHeaderOnclick('tarjan')));
headerMenu.addItem(makeHeaderButton("EDMONDS-KARP", makeHeaderOnclick('edmondskarp')));

menus.push(headerMenu); // add to the global menus array

const hintMenuWidth = 600;
const hintMenuHeight = 100;
function generateHintMenu(text){
    const menu = new Menu(
        hintMenuWidth, hintMenuHeight,
        (canvas.width - hintMenuWidth) / 2, canvas.height - hintMenuHeight - 80,
        false // no border
    );
    const hintMenuFont = '300 32px Open Sans, sans-serif';
    menu.addItem(new TextButton(
        text,
        hintMenuWidth, hintMenuHeight,
        (canvas.width - hintMenuWidth) / 2, canvas.height - hintMenuHeight - 40,
        null, 'center', hintMenuFont,
        null, 0, '#999999' // gray
    ));
    menu.items[0].disable();
    return menu;
}
const typingMenu = generateHintMenu('Press Enter to set new edge weight, or Esc to cancel');

function loadTypingMenu() {
    if (menus.includes(typingMenu)) return; // already loaded
    menus.push(typingMenu);
}
function unloadTypingMenu() {
    if (!menus.includes(typingMenu)) return; // already unloaded
    menus.splice(menus.indexOf(typingMenu), 1);
}

const algorithmRunningHintMenu = generateHintMenu('Algorithm is running; Press P to pause, or Esc to quit');
const algorithmPausedHintMenu = generateHintMenu('Algorithm is paused; Press P to resume, or Esc to quit');
const selectSourceHintMenu = generateHintMenu('Select a new source vertex, or press Esc to cancel');
const selectSinkHintMenu = generateHintMenu('Select a new sink vertex, or press Esc to cancel');
const addVertexHintMenu = generateHintMenu('Click anywhere to add a new vertex');
const delVertexHintMenu = generateHintMenu('Click on any vertex to delete it');
const addEdgeHintMenu = generateHintMenu('Click on two vertices to add an edge between them');
const delEdgeHintMenu = generateHintMenu('Click on an edge to delete it');
const moveVertexHintMenu = generateHintMenu('Click and drag a vertex to move it');
let activeHintMenu = null; 
function currentHintMenu() {
    if(algorithmRunning){
        if(algorithmPaused){
            return algorithmPausedHintMenu;
        }else{
            return algorithmRunningHintMenu;
        }
    }else if(mode != mode.TYPING){ // typing does its own thing
        switch (mode) {
            case Mode.SELECT_SOURCE: return (selectSink ? selectSinkHintMenu : selectSourceHintMenu);
            case Mode.ADD_VERTEX: return addVertexHintMenu;
            case Mode.DEL_VERTEX: return delVertexHintMenu;
            case Mode.ADD_EDGE: return addEdgeHintMenu;
            case Mode.DEL_EDGE: return delEdgeHintMenu;
            case Mode.MOVE_VERTEX: return moveVertexHintMenu;
            default: return null; // no active hint menu
        }
    }
}
let showHintMenu = true;
function loadHintMenu() {
    const menu = (showHintMenu || mode == Mode.SELECT_SOURCE) ? currentHintMenu() : null;
    if (menu !== activeHintMenu) {
        if (activeHintMenu) {
            menus.splice(menus.indexOf(activeHintMenu), 1); // remove old menu
        }
        if (menu) {
            menus.push(menu);
        }
        activeHintMenu = menu;
    }
}


const selectSourceMenuWidth = paletteButtonWidth * 2 + 50;
const selectSourceMenuHeight = 150;
const selectSourceMenuX = paletteMenuX - 25;
const selectSourceMenuY = paletteMenuY + paletteMenuHeight + 10;
const selectSourceMenu = new Menu(
    selectSourceMenuWidth, selectSourceMenuHeight,
    selectSourceMenuX, selectSourceMenuY,
    false // no border
);

class CurrentSourceButton extends TextButton {
    constructor(x, y, width, height) {
        const cs = sourceVertex ? sourceVertex.label : (vertices.length > 0 ? vertices[0].label : 'None'); 
        super('Current Source: ' + cs, width, height, x, y,
            null, 'center', defaultMenuFont,
            null, 0, 'black');
    }
    draw(ctx) {
        if(!algorithmRunning){
            // if source not in vertices set to null
            if (sourceVertex && !vertices.includes(sourceVertex)) {
                sourceVertex = null;
            }
            this.text = 'Current Source: ' + (sourceVertex ? sourceVertex.label : (vertices.length > 0 ? vertices[0].label : 'None'));
        }
        super.draw(ctx);
    }
}
let selectSourcePreviousMode = Mode.ADD_VERTEX; // store the previous mode before selecting source
selectSourceMenu.addItem(new CurrentSourceButton(
    selectSourceMenuX, selectSourceMenuY,
    selectSourceMenuWidth, 50
));
selectSourceMenu.addItem(new TextButton(
    'Select New Source', selectSourceMenuWidth, 30,
    selectSourceMenuX, selectSourceMenuY + 50,
    () => {
        if (algorithmRunning) return; // don't change source while running
        if (mode == Mode.SELECT_SOURCE) {
            //  cancel it
            mode = selectSourcePreviousMode;
            resetMode();
            return;
        }
        if (mode == Mode.TYPING){
            return;
        }
        selectSourcePreviousMode = mode;
        mode = Mode.SELECT_SOURCE;
        selectSink = false;
        // resetMode();

    }, 'center', '12px Inter, sans-serif',
    '#E6E6E6', 1, 'black'
));

function loadSelectSourceMenu() {
    if (menus.includes(selectSourceMenu)) return; // already loaded
    menus.push(selectSourceMenu);
    requestAnimationFrame(() => draw());
}
function unloadSelectSourceMenu() {
    if (!menus.includes(selectSourceMenu)) return; // already unloaded
    menus.splice(menus.indexOf(selectSourceMenu), 1);
    requestAnimationFrame(() => draw());
}


const selectSinkMenu = new Menu(
    selectSourceMenuWidth, selectSourceMenuHeight,
    selectSourceMenuX, selectSourceMenuY + 90,
    false // no border
);

class CurrentSinkButton extends TextButton {
    constructor(x, y, width, height) {
        const cs = sinkVertex ? sinkVertex.label : (vertices.length > 0 ? vertices[0].label : 'None'); 
        super('Current Sink: ' + cs, width, height, x, y,
            null, 'center', defaultMenuFont,
            null, 0, 'black');
    }
    draw(ctx) {
        if(!algorithmRunning){
            // if sink not in vertices set to null
            if (sinkVertex && !vertices.includes(sinkVertex)) {
                sinkVertex = null;
            }
            this.text = 'Current Sink: ' + (sinkVertex ? sinkVertex.label : (vertices.length > 0 ? vertices[vertices.length - 1].label : 'None'));
        }
        super.draw(ctx);
    }
}

selectSinkMenu.addItem(new CurrentSinkButton(
    selectSourceMenuX, selectSourceMenuY,
    selectSourceMenuWidth, 50
));
selectSinkMenu.addItem(new TextButton(
    'Select New Sink', selectSourceMenuWidth, 30,
    selectSourceMenuX, selectSourceMenuY + 50,
    () => {
        if (algorithmRunning) return; // don't change sink while running
        if (mode == Mode.SELECT_SOURCE) {
            //  cancel it
            mode = selectSourcePreviousMode;
            resetMode();
            return;
        }
        if (mode == Mode.TYPING){
            return;
        }
        selectSourcePreviousMode = mode;
        mode = Mode.SELECT_SOURCE;
        selectSink = true;
        // resetMode();
    }, 'center', '12px Inter, sans-serif',
    '#E6E6E6', 1, 'black'
));
function loadSelectSinkMenu() {
    if (menus.includes(selectSinkMenu)) return; // already loaded
    menus.push(selectSinkMenu);
    requestAnimationFrame(() => draw());
}
function unloadSelectSinkMenu() {
    if (!menus.includes(selectSinkMenu)) return; // already unloaded
    menus.splice(menus.indexOf(selectSinkMenu), 1);
    requestAnimationFrame(() => draw());    
}
    

const toolTipMenuX = canvas.width - 50;
const toolTipMenuY = headerMenu.height + 15;
class ToolTipButton extends TextButton {
    constructor() {
        super('?', 30, 30, toolTipMenuX, toolTipMenuY,
              () => {
                  if (algorithmRunning) return; // don't show tooltip while running
                  if (mode == Mode.TYPING) return; // don't show tooltip while typing
                  openToolTip();
              }, 'center', '24px Inter, sans-serif',
              'rgba(0, 0, 0, 0.1)', 0, 'black');
    }
    draw(ctx) {
        // draw a circle around the QM
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = this.highlightColor;
        ctx.fill();
        ctx.closePath();
        const tmp = this.highlightColor;
        this.highlightColor = null;
        super.draw(ctx);
        this.highlightColor = tmp;
    }
}

const toolTipButtonMenu = new Menu(
    30, 30,
    toolTipMenuX, toolTipMenuY,
    false // no border
);
toolTipButtonMenu.addItem(new ToolTipButton());
menus.push(toolTipButtonMenu); // add to the global menus array


class ToolTipGrayOut extends TextButton {
    constructor() {
        super('', canvas.width, canvas.height,
            0, 0, null, 'center', '24px Inter, sans-serif',
            'rgba(0, 0, 0, 0.5)', 0, 'black');
        this.x = 0; // override x and y to cover the whole canvas
        this.y = 0; // override x and y to cover the whole canvas
        this.onClick = closeToolTip; // close tooltip on click
    }
    inBounds(x, y) {
        return true; // always in bounds to cover the whole canvas
    }
    draw(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}
const toolTipWidth = 1000;
const toolTipHeight = 600;
const toolTipX = (canvas.width - toolTipWidth) / 2;
const toolTipY = (canvas.height - toolTipHeight) / 2;
class ToolTip extends TextButton {
    constructor(text) {
        super(text, toolTipWidth, toolTipHeight,
              toolTipX, toolTipY,
              null, 'center', '16px Inter, sans-serif', 
              '#E6E6E6', 2, 'black');
    }
}
const toolTipMenu = new Menu(
    canvas.width, canvas.height,
    0, 0, false // no border
);
// bypass addItem
toolTipMenu.items.push(new ToolTipGrayOut());
const ttxButton = new TextButton( // like the directed edges button
        'X', 30, 30,
        toolTipX + toolTipWidth - 40, toolTipY + 10,
        closeToolTip, 'center', 'bold 24px Montserrat, sans-serif', 
        null, 1, 'black'
    );


const bfsDescription = `Breadth-first Search (BFS) is a fundamental graph traversal algorithm.

BFS explores new vertices in the order they were discovered, before visiting vertices further away.

A queue data structure is used to keep track of the next vertex to explore, and ensure that all vertices are visited in the correct order.

Along with DFS, BFS is one of the most fundamental algorithms in computer science, and many other graph algorithms build on top of it.

Time Complexity: O(V + E)
`

const dfsDescription = `Depth-first Search (DFS) is a fundamental graph traversal algorithm.

DFS explores as far as possible along each branch before backtracking, effectively exploring the "deepest" vertices first.

Recursion is typically used to implement DFS, implicitly storing vertices still being explored on the call stack.

Along with BFS, DFS is one of the most fundamental algorithms in computer science, and many other graph algorithms build on top of it.

Time Complexity: O(V + E)
`

const twoColoringDescription = `2-Coloring is a graph coloring algorithm that determines if a graph is bipartite.

A graph is bipartite if each vertex can be colored with two colors such that no two adjacent vertices have the same color.

By fixing one color for a given vertex, we can propagate this choice to all its neighbors, alternating colors as we go.

It may seem obvious that this intuitive idea lets you color the graph quickly - but consider that with just 3 colors, the problem becomes NP-complete! 

Bipartite graphs are useful in many applications, such as scheduling or matching.

Time Complexity: O(V + E)
`

const dijkstraDescription = `Dijkstra's algorithm is a classic algorithm for finding the shortest path from a source vertex to all other vertices in a weighted graph.

In a graph without negative-weight edges, for whichever unprocessed vertex is currently the closest to the source, 
it is impossible to find a shorter path to it than the one already found.

Using a priority queue, we can find the closest unprocessed vertex efficiently, in only log(V) time, and update the distances to its neighbors.

We repeat this until we have processed all vertices, and found the shortest path to each vertex (or that no path at all exists).

Time Complexity: O(E log V)

This animation highlights the edges that are used by any vertex to calculate its shortest path.
`

const bellmanfordDescription = `A major limitation of Dijkstra's algorithm is that it assumes there are no negative-weight edges.

Bellman-Ford is a single-source shortest path algorithm that can accept graphs with negative-weight edges, 
and even negative-weight cycles, at the cost of a higher time complexity.

Any simple (non-cyclic) path from the source to a vertex will use at most |V| - 1 edges.

Bellman-Ford iterates through all edges |V| - 1 times, updating the distance to each vertex if a shorter path is found.

The only way that we can find a shorter path after |V| - 1 iterations is if there is a negative-weight cycle reachable from the source.

These negative-weight cycles can then be propagated to detect all vertices whose shortest path can be made arbitrarily small.

Time Complexity: O(V * E)

The animation highlights the edges that are used by any vertex to calculate its shortest path, however, 
as the parents of this vertex may be updated after this edge is explored, the shortest paths to each vertex may not reflect the edges highlighted.
`

const primsDescription = `The minimum spanning tree (MST) of a graph is the set of edges with minimum weight that does not form any cycles.

Prim's algorithm is a greedy algorithm that finds the MST of an undirected graph.

Starting with a single source, we continuously add the minimum-weight edge that connects a new vertex to the growing tree.

Using min-heap (or similar data structure) allows us to quickly find the next minimum-weight edge.

This greedy algorithm always yields a spanning tree with minimum weight, although such a tree may not be unique.

Time Complexity: O(E log V) 

During the animation, each vertex displays the minimum cost to connect it to the growing tree.
`

const kruskalsDescription = `The minimum spanning tree (MST) of a graph is the set of edges with minimum weight that does not form any cycles.

Kruskal's algorithm is a greedy algorithm that finds the MST of an undirected graph.

We first sort all edges by weight, and continuously add edges that do not form a cycle to the growing tree.

Using a disjoint-set data structure (such as union-find) allows us to efficiently check if adding an edge would create a cycle.

This greedy algorithm always yields a spanning tree with minimum weight, although such a tree may not be unique.

Time Complexity: O(E log E) = O(E log V)
`

const toposortDescription = `The topological sort of a directed acyclic graph (DAG) is an ordering of its vertices such that for every directed edge (u -> v), 
vertex 'u' comes before vertex 'v' in the ordering.

A topological sorting may not be unique, and if a cycle exists, no topological sorting is possible.

Kahn's algorithm is a BFS-based algorithm that finds a topological sorting of a DAG.

Vertices without any incoming edges can be removed immediately from the graph, and placed into the sorting.

But after placing these vertices into the sorting, we no longer care about their outgoing edges and can remove them from the graph too.

After repeating this process, we will either find a topological sorting of the graph, or determine that a cycle exists somewhere.

Time Complexity: O(V + E)

This animation shows the count of incoming edges for each vertex.
`

const floydwarshallDescription = `The Floyd-Warshall algorithm finds the shortest paths between all pairs of vertices in a weighted graph.

It works by repeatedly selecting a pivot vertex 'k', and for all pairs (u,v), checking if a new shortest path exists through 'k'.

For any given path from 'u' to 'v', the algorithm will consider all vertices on this path as potential pivots, 
guaranteeing all possible paths are considered.

The Floyd-Warshall algorithm works on graphs with negative-weight edges, and detects a negative-weight cycle by checking if
the distance from a vertex to itself becomes negative after the algorithm completes.

Time Complexity: O(V^3)

During this animation, the pivot vertex is highlighted in yellow, and the vertices u and v are highlighted in red or green,
depending on whether a shorter path was found through the pivot.
`

const tarjanDescription = `A strongly connected component (SCC) of a directed graph is a maximal subgraph where every vertex is reachable from every other vertex.

Tarjan's SCC algorithm is a DFS-based algorithm that finds all SCCs in a directed graph.

While traversing the graph in the DFS, we keep track of the discovery time of each vertex, 
and the lowest discovery time (of an unprocessed vertex) reachable from it.

If we can reach an unprocessed vertex with a lower discovery time than the current vertex, then this vertex is still on the call-stack,
so we aren't finished building this component yet.

If we can not reach such a vertex, then this other vertex is the last vertex being processed in this component, 
and we can add all vertices reachable from it to a new component.

A stack is used to efficiently keep track of the vertices still being processed, and to build the components.

Time Complexity: O(V + E)

During this animation, each vertex is labeled with the format (discovery time | lowlink).
`

const edmondsKarpDescription = `The maximum-flow problem asks for the maximum flow from a source vertex to a sink vertex in a flow network, such that 
no edge accepts more flow than its capacity, and the amount of flow into any given vertex is equal to the amount of flow out of it.

The Edmonds-Karp algorithm is a BFS-based algorithm that finds the maximum flow in a flow network.

It works by repeatedly finding "augmenting paths" (paths from the source to the sink that can still accept more flow) using BFS.

After we find such a path, we add this amount of flow to each edge on the path, to ensure no edge accepts more flow than its capacity.

However, it may be possible that we made a "mistake", and sent flow in a direction that isn't optimal. 

We can allow the algorithm to "undo" this flow by subtracting the same amount from the edge in the opposite direction.

During this process, the resulting "flow" may become negative, but this is necessary to ensure that any step can be undone.

After this process converges, we will have found the maximum flow from the source to the sink.

Time Complexity: Each edge can be saturated at most O(V) times, and each BFS takes O(E), so the total time complexity is O(V * E^2).
Although, typically, the algorithm converges much faster than this worst-case upper-bound.

During this animation, each vertex is labeled with the maximum flow of the augmenting path that contains it 
(the minumum remaining capacity of any edge on the path).
`
function getToolTipText() {
    
    switch (currentAlgorithm) {
    case 'bfs':
        return bfsDescription;
    case 'dfs':
        return dfsDescription;
    case '2coloring':
        return twoColoringDescription;
    case 'dijkstra':
        return dijkstraDescription;
    case 'bellmanford':
        return bellmanfordDescription;
    case 'prims':
        return primsDescription;
    case 'kruskals':
        return kruskalsDescription;
    case 'toposort':
        return toposortDescription;
    case 'floydwarshall':
        return floydwarshallDescription;
    case 'tarjan':
        return tarjanDescription;
    case 'edmondskarp':
        return edmondsKarpDescription;
    }  
    return 'No descrption :(';
}

function openToolTip() {
    const found = toolTipMenu.items.find(menu => menu instanceof ToolTip);
    if (found) {
        toolTipMenu.items.splice(toolTipMenu.items.indexOf(found), 1); // remove old tooltip if exists
    }
    const toolTipText = getToolTipText();
    const toolTip = new ToolTip('');
    const lines = toolTipText.split('\n');
    toolTipMenu.items.length = 0;
    toolTipMenu.items.push(new ToolTipGrayOut()); // add the gray out first
    toolTipMenu.items.push(toolTip);
    
    let cy = toolTipY + 30; // start below the title
    for (const line of lines) {
        const textButton = new TextButton(
            line, toolTipWidth - 20, 20,
            toolTipX + 10, cy,
            null, 'center', '14px Inter, sans-serif',
            null, 0, 'black'
        );
        toolTipMenu.items.push(textButton);
        cy += 20; // move down for the next line
    }
    
    toolTipMenu.items.push(ttxButton); // add the close button
    tooltipMenus.length = 0;
    tooltipMenus.push(toolTipMenu); // add to the global tooltip menus array

}
function closeToolTip() {
    // clear tooltipMenus
    tooltipMenus.length = 0; // clear the tooltipMenus array
}

const toolDescription = `
Change mode using the above buttons or keyboard:
V: Add a vertex
X: Delete a vertex
E: Add an edge
Q: Delete an edge
M: Move a vertex
H: Toggle hint menu
R: Run/Pause the algorithm
Double click an edge to change its weight
If things don't look right, please try zooming out and reloading the page :')
Current mode:`
function getModeText(){

    let modeText = '';
    switch (mode) {
        case Mode.ADD_VERTEX: modeText = 'Add Vertex'; break;
        case Mode.DEL_VERTEX: modeText = 'Delete Vertex'; break;
        case Mode.ADD_EDGE: modeText = 'Add Edge'; break;
        case Mode.DEL_EDGE: modeText = 'Delete Edge'; break;
        case Mode.MOVE_VERTEX: modeText = 'Move Vertex'; break;
        case Mode.SELECT_SOURCE: modeText = (selectSink ? 'Select New Sink' : 'Select New Source'); break;
        case Mode.TYPING: modeText = 'Entering Edge Weight'; break;
        default: modeText = 'Unknown';
    }
    if(algorithmRunning) {
        modeText = (algorithmPaused ? 'Algorithm Paused' : 'Algorithm Running');
    }
    return modeText;
}
function getToolDescription() {
    return toolDescription + ' ' + getModeText();
}
const toolDescriptionMenuWidth = 400;
const toolDescriptionMenuHeight = 225;
const toolDescriptionMenuX = 10;
const toolDescriptionMenuY = canvas.height - toolDescriptionMenuHeight - 10;
const toolDescriptionFont = 'bold 12px Inter, sans-serif';
const toolFontColor = '#777777'; // dark gray
const toolDescriptionMenu = new Menu(
    toolDescriptionMenuWidth, toolDescriptionMenuHeight,
    toolDescriptionMenuX, toolDescriptionMenuY,
    false // no border
);
const toolDescriptionLineHeight = 18;
function getToolDescriptionButton(text) {
    const res = new TextButton(
        text, toolDescriptionMenuWidth, toolDescriptionLineHeight,
        toolDescriptionMenuX, toolDescriptionMenuY + toolDescriptionLineHeight * toolDescriptionMenu.items.length,
        null, 'left', toolDescriptionFont,
        null, 0, toolFontColor
    );
    res.disable();
    return res;
}
const lines = getToolDescription().split('\n');
for(const line of lines) { 
    const toolDescriptionButton = getToolDescriptionButton(line);
    toolDescriptionMenu.addItem(toolDescriptionButton);
}
menus.push(toolDescriptionMenu); // add to the global menus array

function loadToolDescrMenu() {
    const len = toolDescriptionMenu.items.length;
    toolDescriptionMenu.items[len - 1].text = 'Current mode: ' + getModeText();
}


const presetMenuX = selectSourceMenuX;
const presetMenuY = 470;

const presetButtonFont = '12px Inter, sans-serif';
const presetButtonWidth = 110;
const presetButtonHeight = 20;
const presetMenuHeight = 30 * 10 + 20;

const presetLabel = new TextButton(
    'Select preset:',  presetButtonWidth, 30,
    presetMenuX, presetMenuY,
    null, 'left', defaultMenuFont,
    null, 0, 'black'
);
let loadVertices = [];
let loadEdges = [];
let loadDirected = false;
let loadSourceIdx = -1;
let loadSinkIdx = -1;
function generate_preset_button(name, init){
    const res = new TextButton(
        name, presetButtonWidth, presetButtonHeight,
        presetMenuX, presetMenuY + 30 * (loadVertices.length + 1),
        () => {
            if (algorithmRunning) return; // don't load preset while running
            init();
            vertices.slice().forEach(vertex => delVertex(vertex, true)); // clear existing vertices
            edges.slice().forEach(edge => delEdge(edge)); // clear existing edges
            if(loadDirected && needUndirectedEdges) loadDirected = false;
            if(!loadDirected && needDirectedEdges) loadDirected = true;
            convertEdges(loadDirected); // set directed edges if needed
            for(const vtx of loadVertices) {
                addVertex(vtx[0], vtx[1]);
            }
            for(const edge of loadEdges) {
                addEdge(vertices[edge[0]], vertices[edge[1]], edge[2]);
            }
            sourceVertex = loadSourceIdx >= 0 ? vertices[loadSourceIdx] : null;
            sinkVertex = loadSinkIdx >= 0 ? vertices[loadSinkIdx] : null;
        }, 'center', presetButtonFont,
        '#E6E6E6', 1, 'black'
    );
    return res;
}
const presetMenu = new Menu(
    presetButtonWidth + 20, presetMenuHeight,
    presetMenuX, presetMenuY,
    false // no border
);
function fetchPresets(){
    const res = [];
    res.push(generate_preset_button('example', () => {loadVertices=[[320,120],[520,120],[320,360],[520,360],[520,620],[720,620],[720,360]];loadEdges=[[2,3,6],[2,4,6],[3,5,16],[4,5,2],[1,6,13],[6,5,11],[3,6,4],[1,3,13],[0,2,2],[0,1,3],[3,4,2]];loadDirected=true;loadSourceIdx=0;loadSinkIdx=5;}));
    
    switch (currentAlgorithm) {
    case 'bfs':
    case 'dfs': // shared presets
        res.push(generate_preset_button('directed', () => {loadVertices = [[615, 159], [470, 300], [750, 303], [615, 460], [330, 460], [900, 460], ];loadEdges = [[1, 0, 12], [0, 2, 18], [2, 1, 8], [1, 4, 4], [2, 3, 8], [2, 5, 17], [4, 3, 8], [3, 1, 8], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));    
        res.push(generate_preset_button('undirected', () => {loadVertices = [[615, 159], [470, 300], [750, 303], [615, 460], [330, 460], [900, 460], ];loadEdges = [[1, 0, 12], [0, 2, 18], [2, 1, 8], [1, 4, 4], [2, 3, 8], [2, 5, 17], [4, 3, 8], [3, 1, 8], ];loadDirected=false;loadSourceIdx=-1;loadSinkIdx=-1;}));    
        res.push(generate_preset_button('tree', () => {loadVertices = [[687, 126], [465, 244], [970, 246], [309, 389], [506, 388], [732, 549], [1104, 387], [842, 386], [969, 543], [225, 569], [408, 564], [600, 552], [854, 699], [1054, 702], ];loadEdges = [[0, 1, 7], [0, 2, 6], [2, 7, 2], [2, 6, 2], [7, 8, 18], [7, 5, 14], [1, 3, 14], [3, 9, 5], [1, 4, 16], [4, 10, 2], [4, 11, 15], [8, 12, 11], [8, 13, 11], ];loadDirected=false;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('maze', () => {loadVertices = [[400, 130], [531, 130], [662, 130], [793, 130], [925, 130], [400, 260], [531, 260], [662, 260], [793, 260], [925, 260], [400, 390], [531, 390], [662, 390], [793, 390], [925, 390], [400, 520], [531, 520], [662, 520], [793, 520], [925, 520], [400, 650], [531, 650], [662, 650], [793, 650], [925, 650], ];loadEdges = [[0, 5, 20], [5, 6, 15], [10, 15, 16], [15, 20, 19], [20, 21, 1], [16, 11, 10], [17, 22, 19], [17, 18, 9], [18, 23, 15], [23, 24, 10], [13, 12, 18], [12, 17, 3], [18, 19, 13], [6, 11, 2], [5, 10, 10], [1, 2, 17], [0, 1, 9], [2, 3, 5], [3, 8, 11], [8, 7, 11], [13, 14, 1], [14, 9, 5], [7, 12, 12], [9, 4, 8], ];loadDirected=false;loadSourceIdx=-1;loadSinkIdx=-1;}));
        break;
    case '2coloring':
        res.push(generate_preset_button('square', () => {loadVertices = [[400, 130], [660, 130], [660, 390], [400, 390]];loadEdges = [[0, 1, 10], [1, 2, 10], [2, 3, 10], [3, 0, 10]];loadDirected=false;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('bipartite', () => {loadVertices = [[531, 130], [793, 130], [531, 260], [793, 260], [531, 390], [793, 390], [531, 520], [793, 520], [531, 650], [793, 650], ];loadEdges = [[0, 3, 13], [0, 5, 15], [4, 1, 16], [6, 3, 18], [3, 2, 13], [8, 5, 7], [6, 5, 11], [9, 6, 20], [7, 4, 1], ];loadDirected=false;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('simplegrid1', () => {loadVertices = [[400, 130], [662, 130], [925, 130], [400, 390], [662, 390], [925, 390], [400, 650], [662, 650], [925, 650], ];loadEdges = [[0, 3, 11], [7, 6, 5], [6, 3, 15], [4, 5, 9], [5, 8, 1], [5, 2, 7], [2, 1, 19], [1, 0, 18], [8, 7, 16], [4, 1, 6], ];loadDirected=false;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('simplegrid2', () => {loadVertices = [[400, 130], [662, 130], [925, 130], [400, 390], [662, 390], [925, 390], [400, 650], [662, 650], [925, 650], ];loadEdges = [[0, 3, 11], [7, 6, 5], [6, 3, 15], [4, 5, 9], [5, 8, 1], [5, 2, 7], [2, 1, 19], [1, 0, 18], [8, 7, 16], [4, 1, 6], [6, 4, 8], ];loadDirected=false;loadSourceIdx=-1;loadSinkIdx=-1;}));
        break;
    case 'dijkstra':
        res.push(generate_preset_button('simple', () => {loadVertices = [[583, 133], [408, 303], [761, 307], [570, 482], ];loadEdges = [[0, 1, 19], [1, 3, 4], [1, 2, 2], [2, 1, 4], [0, 2, 9], [2, 3, 17], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('directed', () => {
        loadVertices = [
            [649, 125], [421, 268], [649, 268], [900, 268],
            [421, 492], [649, 492], [900, 492], [649, 688],
        ];
        loadEdges = [
            [4, 7, 7], [2, 1, 3], [0, 1, 9], [3, 6, 8],
            [3, 2, 10], [0, 3, 8], [4, 5, 14], [0, 2, 19],
            [1, 2, 6], [4, 2, 2], [1, 4, 1], [2, 3, 1],
            [6, 5, 1], [2, 5, 3], [5, 7, 1], [6, 7, 9],
        ];
        }));
        res.push(generate_preset_button('undirected', () => {
            loadVertices = [
                [586, 142], [996, 306], [409, 306], [996, 521],
                [409, 521], [848, 142], [586, 675], [824, 675],
            ];
            loadEdges = [
                [2, 4, 11], [7, 3, 3], [3, 1, 6], [0, 5, 7],
                [2, 3, 8], [4, 6, 8], [7, 5, 8], [6, 7, 9],
                [4, 5, 11], [0, 2, 18], [5, 1, 19],
            ];
            loadDirected = false;
            loadSourceIdx = -1;
            loadSinkIdx = -1;
        }));
        loadDirected = true;
        loadSourceIdx = -1;
        loadSinkIdx = -1;
        break;
    case 'bellmanford':        
        res.push(generate_preset_button('simple', () => {loadVertices = [[583, 133], [408, 303], [761, 307], [570, 482], ];loadEdges = [[0, 1, 19], [1, 3, 4], [1, 2, 2], [2, 1, 4], [0, 2, 9], [2, 3, 17], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('directed', () => {
            loadVertices = [
                [649, 125], [421, 268], [649, 268], [900, 268],
                [421, 492], [649, 492], [900, 492], [649, 688],
            ];
            loadEdges = [
                [4, 7, 7], [2, 1, 7], [0, 1, 9], [3, 6, 8],
                [3, 2, 10], [0, 3, -8], [4, 5, 14], [0, 2, 19],
                [1, 2, -6], [4, 2, 9], [1, 4, 1], [2, 3, 1],
                [6, 5, 1], [2, 5, -3], [5, 7, 1], [6, 7, 9],
            ];
        }));
        res.push(generate_preset_button('negativecycle1', () => {loadVertices = [[720, 108], [587, 251], [504, 404], [700, 397], [900, 307], [723, 617], ];loadEdges = [[2, 5, 2], [1, 2, 0], [3, 1, -1], [2, 3, 0], [0, 1, 10], [0, 4, 4], [4, 5, 1], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('negativecycle2', () => {loadVertices = [[628, 106], [466, 243], [625, 369], [792, 244], [434, 476], [625, 578], [798, 473], [514, 715], [744, 715], ];loadEdges = [[5, 7, 13], [5, 8, 18], [5, 4, -17], [2, 5, 17], [2, 4, 7], [4, 2, 4], [2, 6, 3], [6, 5, 9], [4, 7, 2], [1, 2, 5], [0, 1, 5], [0, 3, 11], [2, 3, 8], [3, 1, -12], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        break;
    case 'prims':
    case 'kruskals': // shared presets
        res.push(generate_preset_button('simple', () => {loadVertices = [[526, 205], [744, 195], [432, 410], [636, 547], [821, 413], ];loadEdges = [[4, 2, 1], [1, 2, 6], [0, 1, 10], [2, 0, 12], [2, 3, 14], [3, 4, 16], [4, 1, 19], ];loadDirected=false;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('larger', () => {
            loadVertices = [
                [370, 263], [542, 122], [728, 297], [542, 482],
                [542, 331], [728, 536], [370, 536], [542, 689],
                [836, 710], [960, 408], [836, 122],
            ];
            loadEdges = [
                [5, 3, 1], [5, 7, 1], [3, 7, 1], [6, 0, 2],
                [5, 9, 2], [1, 0, 4], [2, 5, 6], [6, 3, 7],
                [8, 5, 9], [4, 1, 11], [1, 2, 13], [2, 10, 14],
                [0, 4, 17], [6, 7, 20],
            ];
            loadDirected = false;
            loadSourceIdx = -1;
            loadSinkIdx = -1;
        }));

        break;
    case 'toposort':
        res.push(generate_preset_button('square', () => {loadVertices = [[400, 130], [660, 130], [660, 390], [400, 390], ];loadEdges = [[0, 3, 2], [0, 2, 16], [1, 2, 12], [2, 3, 9], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('smallcycle', () => {loadVertices = [[400, 130], [660, 130], [660, 390], [400, 390], ];loadEdges = [[3, 0, 2], [0, 2, 16], [1, 2, 12], [2, 3, 9], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('larger', () => {loadVertices = [[531, 130], [793, 130], [400, 260], [662, 260], [925, 260], [531, 390], [796, 391], [531, 520], [793, 520], [400, 650], [662, 650], [925, 650], ];loadEdges = [[0, 3, 7], [1, 3, 18], [2, 5, 5], [2, 3, 1], [3, 5, 9], [5, 6, 13], [6, 8, 11], [8, 7, 15], [5, 7, 18], [7, 10, 4], [10, 11, 4], [8, 11, 12], [7, 9, 20], [4, 6, 1], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('largercycle', () => {loadVertices = [[531, 130], [793, 130], [400, 260], [662, 260], [925, 260], [531, 390], [793, 390], [662, 520], [531, 650], [793, 650], [925, 650], ];loadEdges = [[9, 10, 10], [0, 2, 3], [2, 5, 12], [5, 3, 16], [3, 6, 10], [6, 7, 20], [7, 5, 10], [6, 9, 5], [7, 9, 10], [7, 8, 7], [1, 3, 5], [4, 3, 8], [4, 6, 4], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        break;
    case 'floydwarshall':
        res.push(generate_preset_button('simple', () => {loadVertices = [[400, 130], [660, 130], [660, 390], [400, 390], ];loadEdges = [[3, 0, 2], [0, 2, 1], [1, 2, 4], [2, 3, 9], [0, 1, 14], ];loadDirected=false;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('negative_cycle1', () => {loadVertices = [[400, 130], [660, 130], [660, 390], [400, 390], ];loadEdges = [[3, 0, 2], [1, 2, 4], [2, 3, 1], [0, 1, 14], [0, 2, -5], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('chain', () => {
            loadVertices = [
                [662, 260], [793, 390], [662, 390],
                [531, 130], [400, 130], [531, 260],
                [793, 520]
            ];
            loadEdges = [
                [1, 2, 4], [4, 3, 9], [0, 2, 12],
                [6, 1, 5], [0, 5, 3], [5, 3, 1],
            ];
            loadDirected = false;
            loadSourceIdx = -1;
            loadSinkIdx = -1;
        }));
        res.push(generate_preset_button('larger', () => {loadVertices = [[896, 410], [800, 610], [583, 660], [409, 521], [409, 299], [583, 160], [800, 210], ];loadEdges = [[3, 2, 3], [2, 1, 17], [1, 0, 7], [0, 6, 7], [6, 5, 3], [5, 4, 18], [4, 3, -14], [4, 2, 20], [4, 1, 16], [1, 5, 19], [4, 5, 3], [5, 2, 3], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('negative_cycle2', () => {loadVertices = [[896, 410], [800, 610], [583, 660], [409, 521], [409, 299], [583, 160], [800, 210], ];loadEdges = [[3, 2, 3], [2, 1, 14], [1, 0, 7], [0, 6, 7], [6, 5, 3], [5, 4, 6], [4, 3, -14], [4, 2, 20], [1, 5, 9], [4, 5, 3], [2, 5, 3], [4, 1, 16], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        break;
    case 'tarjan':
        res.length = 0;
        res.push(generate_preset_button('example', () => {loadVertices=[[320,120],[520,120],[320,360],[520,360],[520,620],[720,620],[720,360]];loadEdges=[[2,3,6],[2,4,6],[3,5,16],[4,5,2],[1,6,13],[6,5,11],[3,6,4],[1,3,13],[0,2,2],[0,1,3],[4,3,2],[3,4,2],[5,4,2]];loadDirected=true;loadSourceIdx=0;loadSinkIdx=5;}));
        res.push(generate_preset_button('simple1', () => {loadVertices = [[400, 130], [662, 130], [925, 130], [400, 390], [662, 390], [925, 390], ];loadEdges = [[3, 4, 7], [0, 1, 4], [4, 0, 1], [0, 3, 9], [1, 5, 3], [5, 2, 7], [2, 1, 14], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('larger1', () => {loadVertices = [[400, 130], [531, 130], [662, 130], [793, 130], [531, 260], [662, 260], [793, 260], [531, 390], [662, 390], [531, 520], [662, 520], ];loadEdges = [[4, 7, 2], [1, 2, 17], [2, 3, 5], [3, 6, 11], [6, 5, 11], [0, 4, 7], [4, 1, 20], [1, 0, 15], [7, 9, 1], [9, 10, 13], [10, 8, 6], [8, 7, 14], [2, 5, 13], [5, 8, 16], [5, 3, 11], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('larger2', () => {loadVertices = [[400, 130], [662, 130], [793, 130], [925, 130], [400, 260], [531, 260], [662, 260], [808, 262], [925, 260], [400, 390], [531, 390], [793, 390], [400, 520], [531, 520], [676, 503], [924, 509], [724, 647], [867, 650], [402, 647], [537, 649], ];loadEdges = [[14, 15, 18], [14, 16, 12], [16, 17, 8], [13, 12, 1], [9, 12, 8], [10, 12, 19], [9, 10, 17], [12, 9, 10], [10, 13, 2], [0, 4, 11], [4, 5, 2], [5, 0, 8], [5, 10, 12], [5, 6, 4], [6, 7, 10], [7, 1, 16], [1, 6, 12], [1, 2, 6], [8, 3, 10], [8, 2, 13], [3, 8, 4], [2, 8, 20], [11, 14, 20], [17, 11, 20], [16, 15, 12], [15, 11, 5], [13, 18, 9], [18, 19, 9], [19, 13, 5], [13, 16, 9], [6, 11, 9], [8, 11, 13], [6, 10, 5], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        break;
    case 'edmondskarp':
        res.push(generate_preset_button('simple', () => {loadVertices = [[567, 119], [408, 303], [744, 294], [570, 482], ];loadEdges = [[0, 1, 19], [1, 3, 4], [1, 2, 2], [0, 2, 9], [2, 3, 17], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
        res.push(generate_preset_button('need_backedge', () => {loadVertices = [[662, 130], [400, 260], [531, 260], [793, 260], [531, 520], [793, 520], [662, 650], ];loadEdges = [[0, 2, 8], [0, 3, 9], [2, 1, 18], [1, 4, 17], [4, 6, 30], [5, 6, 8], [3, 5, 16], [2, 5, 12], ];loadDirected=true;loadSourceIdx=-1;loadSinkIdx=-1;}));
       res.push(generate_preset_button('larger', () => {
            loadVertices = [
                [670, 126], [423, 275], [925, 126], [925, 390],
                [423, 647], [925, 647], [670, 647], [670, 275]
            ];
            loadEdges = [
                [0, 2, 15], [0, 1, 19], [1, 4, 8], [4, 6, 12],
                [2, 3, 20], [3, 5, 14], [1, 7, 19], [7, 4, 16],
                [7, 6, 8], [5, 6, 13], [2, 6, 6]
            ];
            loadDirected = true;
            loadSourceIdx = 0;
            loadSinkIdx = 6;
        }));

    }

    res.push(generate_preset_button('clear', () => {loadVertices = []; loadEdges = []; loadDirected = false; loadSourceIdx = -1; loadSinkIdx = -1;}));
    return res;
}
presetMenu.addItem(presetLabel);
menus.push(presetMenu);
let presetCache = null;
function loadPresetMenu() {
    if(presetCache != currentAlgorithm){
        presetCache = currentAlgorithm;
        presetMenu.items.length = 1; // clear all but the label
        const presetButtons = fetchPresets();
        presetButtons.forEach(btn => presetMenu.addItem(btn));
    }
}

// clear the canvas and draw everything
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    edges.forEach(edge => edge.draw(ctx)); // draw edges first; vertex covers edge otherwise
    animationObjects.forEach(obj => obj.draw(ctx));
    vertices.forEach(vertex => vertex.draw(ctx)); // draw vertices last
    menus.forEach(menu => menu.draw(ctx));
    for (let i = animationObjects.length - 1; i >= 0; i--) {
        if (animationObjects[i].expired()) {
            animationObjects.splice(i, 1);
        }
    }
    if ( edgeMessage.aX != -1 ){
        ctx.beginPath();
        ctx.moveTo(edgeMessage.aX, edgeMessage.aY);
        ctx.lineTo(edgeMessage.bX, edgeMessage.bY);
        ctx.lineWidth = edgeBrushWidth;
        ctx.strokeStyle = 'red';
        ctx.stroke();
        ctx.closePath();
    }
    // draw tooltip menu last
    if(tooltipMenus.length > 0) {
        tooltipMenus.forEach(btn => btn.draw(ctx));
    }
}



// add a new vertex to the canvas
function addVertex(x, y) {
    const vertex = new Vertex(x, y);
    vertices.push(vertex);
    draw();
}

function addEdge(vertexA, vertexB, label=null) {
    if(directedEdges){
        const edge = new DirectedEdge(vertexA, vertexB);
        if(label !== null) {
            edge.weight = label;
            edge.resetLabel();
        }
        if(edges.find(e => (e.vertexA == vertexA && e.vertexB == vertexB))) {
            return; // No duplicate edges
        }
        edges.push(edge);
    }else{
        const edge = new Edge(vertexA, vertexB);
        if(label !== null) {
            edge.weight = label;
            edge.resetLabel();
        }
        if (edges.find(e => (e.vertexA == vertexA && e.vertexB == vertexB) || (e.vertexA == vertexB && e.vertexB == vertexA))) {
            return; // No duplicate edges
        }
        edges.push(edge);
    }
    draw();
}

function delVertex(vertex, killBounceBack=false) {
    animationObjects.push(new DeleteVertexAnimation(vertex, killBounceBack));
    vertices.splice(vertices.indexOf(vertex), 1);
    draw();
}

function delEdge(edge) {
    if (edge instanceof DirectedEdge) {
        animationObjects.push(new DeleteDirectedEdgeAnimation(edge));
    } else {
        animationObjects.push(new DeleteEdgeAnimation(edge));
    }
    edges.splice(edges.indexOf(edge), 1);
    draw();
}

function vertexAt(x, y) {
    return vertices.find(vertex => {
        const dx = vertex.x - x;
        const dy = vertex.y - y;
        return dx * dx + dy * dy <= vertex.radius * vertex.radius;
    });
}

// translated from KACTL: https://github.com/kth-competitive-programming/kactl/
function segmentDistance(s, e, p) {
    const d = (e.x - s.x) * (e.x - s.x) + (e.y - s.y) * (e.y - s.y);
    if (d == 0) return sqrt((p.x - s.x) * (p.x - s.x) + (p.y - s.y) * (p.y - s.y));
    const t = Math.min(d, Math.max(0, (p.x - s.x) * (e.x - s.x) + (p.y - s.y) * (e.y - s.y)));
    const dx = (p.x - s.x) * d - (e.x - s.x) * t;
    const dy = (p.y - s.y) * d - (e.y - s.y) * t;
    return Math.sqrt(dx * dx + dy * dy) / d;
}

    // edges can overlap; if close enough to any edge, returns any of them
function edgeAt(x, y) {
    return edges.find(edge => edge.hitTest(x, y));
}

function sliderAt(x, y) {
    for (const menu of menus) {
        for (const item of menu.items) {
            if (item instanceof AnimationSpeedSlider && item.inBoundsSlider(x, y)) {
                return item;
            }
        }
    }
    return null;
}
function buttonAt(x,y) {
    if(tooltipMenus.length > 0) {
        for (let i = tooltipMenus[0].items.length - 1; i >= 0; i--) {
            if (tooltipMenus[0].items[i].inBounds(x, y)) {
                return tooltipMenus[0].items[i]; // return the topmost tooltip menu
            }
        }
    }
    for (const menu of menus) {
        for (const item of menu.items) {
            if (item.inBounds(x, y)) {
                return item;
            }
        }
    }
    return null;
}


function setSelectedVertex(vertex) {
    selectedVertex = vertex;
    vertex.color = 'red';
    draw();
}
function resetSelectedVertex() {
    if (selectedVertex) {
        selectedVertex.color = defaultColor;
        selectedVertex = null;
        draw();
    }
}

function resetMode(){
    resetSelectedVertex();
}

// loadVertices = [[334, 109], [532, 249], [260, 355], [510, 559], ];loadEdges = [[0, 1, 13], [0, 2, 5], [2, 3, 5], ];loadDirected=false;loadSourceIdx=-1;loadSinkIdx=-1;

// TESTING 
loadAlgorithm('dijkstra') 
fetchPresets()[0].onClick(); // load example preset

// listen for clicks on the canvas
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedSlider = sliderAt(x, y);
    if (clickedSlider) {
        clickedSlider.clickSlider(x, y);
        return;
    }
    const clickedButton = buttonAt(x, y);
    if (clickedButton){
        clickedButton.click();
        return;
    }
    if (algorithmRunning) return; 
    const clickedVertex = vertexAt(x, y);
    const clickedEdge = edgeAt(x, y);
    switch (mode) {
        case Mode.ADD_VERTEX:
            if (!clickedVertex) // don't add vertex if clicking on existing vertex
                addVertex(x, y); 
            break;
        case Mode.DEL_VERTEX:
            if (clickedVertex) {
                for (let i = edges.length - 1; i >= 0; i--) {
                    if (edges[i].vertexA == clickedVertex || edges[i].vertexB == clickedVertex) {
                        delEdge(edges[i]);
                    }
                }
                delVertex(clickedVertex);
            }
            break;
        case Mode.ADD_EDGE:
            if (clickedVertex){
                if ( clickedVertex == selectedVertex) {
                    resetSelectedVertex();
                    return;
                } else if (selectedVertex) {
                    addEdge(selectedVertex, clickedVertex);
                    resetSelectedVertex();
                    return;
                } else {
                    setSelectedVertex(clickedVertex);
                }
            }
            break;
        case Mode.DEL_EDGE:
            if (clickedEdge) {
                delEdge(clickedEdge);
            }
            break;
        case Mode.SELECT_SOURCE:
            if (clickedVertex) {
                if (selectSink) {
                    sinkVertex = clickedVertex;
                    sinkVertex.birth = performance.now(); // subtract newVertexAnimationDuration / 2
                    sinkVertex.birth -= newVertexAnimationDuration / 4; // so it doesn't animate again
                    mode = selectSourcePreviousMode;
                    resetMode();
                } else {
                    sourceVertex = clickedVertex;
                    sourceVertex.birth = performance.now(); // subtract newVertexAnimationDuration / 2
                    sourceVertex.birth -= newVertexAnimationDuration / 4; // so it doesn't animate again
                    mode = selectSourcePreviousMode
                    resetMode();
                }
            } 
        default:
            break;
    }
});



canvas.addEventListener('dblclick', (e) => {
    // if(mode == Mode.RUN_ALGORITHM) return;
    if(algorithmRunning) return;
    if(mode == Mode.TYPING) return; // no double click while typing
    if(mode == Mode.SELECT_SOURCE) return; // no double click while selecting source vertex
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedVertex = vertexAt(x, y);
    const clickedEdge = edgeAt(x, y);
    if (clickedVertex) {
        // typingObject = clickedVertex; disabled, i think it's annoying
    } else if (clickedEdge) {   
        if (weightedEdges){
            typingObject = clickedEdge;
        }
    }
    if (typingObject) {
        typingPreviousMode = mode;
        mode = Mode.TYPING;
    }
});

canvas.addEventListener('mousedown', (e) => {
    if(tooltipMenus.length > 0)  return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedSlider = sliderAt(x, y);
    if (clickedSlider) {
        clickedSlider.clickSlider(x, y);
        return;
    }
    if (mode == Mode.MOVE_VERTEX) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        draggingVertex = vertexAt(x, y);
    }else draggingVertex = null;
});

canvas.addEventListener('mousemove', (e) => {
    
    if ((e.buttons & 1) === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedSlider = sliderAt(x, y);
    if (clickedSlider) {
        clickedSlider.clickSlider(x, y);
        return;
    }
    if (draggingVertex) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        draggingVertex.x = x;
        draggingVertex.y = y;
        draw();
    }
});

canvas.addEventListener('mouseup', (e) => {
    draggingVertex = null;
});

canvas.addEventListener('mouseleave', (e) => {
    draggingVertex = null;
});

window.addEventListener('keydown',  async (e) => {
    if(e. key == 'Escape') tooltipMenus.length = 0;
    if(algorithmRunning) {
        if (e.key == 'Escape') {
            algorithmTerminated = true;
        }else if(e.key == 'p'){
            algorithmPaused = !algorithmPaused;
        }
    }else if (mode != Mode.TYPING && mode != Mode.SELECT_SOURCE) {
        const tmp = mode;
        switch (e.key) {
            case 'v':
                mode = Mode.ADD_VERTEX;
                break;
            case 'x':
                mode = Mode.DEL_VERTEX;
                break;
            case 'e':
                mode = Mode.ADD_EDGE;
                break;
            case 'q':
                mode = Mode.DEL_EDGE;
                break;
            case 'm':
                mode = Mode.MOVE_VERTEX;
                break;
            case 'h':
                showHintMenu = !showHintMenu;
                break;
            case 'd':
                let debugString = "loadVertices = [";
                for (const vtx of vertices) {
                    debugString += "[" + vtx.x + ", " + vtx.y + "], ";
                }
                debugString += "];loadEdges = [";
                const findIndex = (vtx) => vertices.indexOf(vtx);
                for (const ed of edges) {
                    debugString += "[" + findIndex(ed.vertexA) + ", " + findIndex(ed.vertexB) + ", " + ed.weight + "], ";
                }
                debugString += "];loadDirected=";
                debugString += directedEdges ? 'true' : 'false';
                debugString += ";loadSourceIdx=";
                debugString += sourceVertex ? findIndex(sourceVertex) : -1;
                debugString += ";loadSinkIdx=";
                debugString += sinkVertex ? findIndex(sinkVertex) : -1;
                debugString += ";";
                console.log(debugString);
                break;
            case 'r':
                await startAlgorithm(async () => {
                    if (vertices.length == 0) return;
                    const source = sourceVertex || vertices[0];
                    algorithmRunning = true;
                    algorithmExecutor(source);
                });
                break;
            default:
                break;
        }
        if (tmp != mode) resetMode();
    } else if (mode == Mode.TYPING) {
        if (e.key == 'Enter') {
            if (typingObject.updateName(typingBuffer)) {
                mode = typingPreviousMode;
                typingBuffer = '';
                typingObject.warning = new Warning();
                typingObject.resetLabel();
                typingObject = null;
                draw();
            } else {

            }
        } else if(e.key == 'Backspace') {
            typingBuffer = typingBuffer.slice(0, -1);
        } else if (e.key == 'Escape') {
            mode = typingPreviousMode;
            typingBuffer = '';
            typingObject.warning = new Warning();
            typingObject.resetLabel();
            typingObject = null;
        } else {
            typingBuffer += e.key;
        }
    }else if (mode == Mode.SELECT_SOURCE) {
        if(e.key == 'Escape') {
            mode = selectSourcePreviousMode;
            resetMode();
        }
    }else {
        // unknown
    }

});

function typingMode() { 
    if (mode == Mode.TYPING && typingObject){
        typingObject.setLabel(typingBuffer);
        loadTypingMenu();
        draw();
    } else {
        unloadTypingMenu();
    }
}
function mainHeartbeat() {
    typingMode();
    loadHintMenu();
    loadPresetMenu();
    loadToolDescrMenu();
    draw();
}

setInterval(mainHeartbeat, 1000/60); // 24 fps







