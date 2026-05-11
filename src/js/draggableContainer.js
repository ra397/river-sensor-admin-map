const draggerClassList = ['drag-cnr tl-cnr', 'drag-cnr tr-cnr', 'drag-cnr bl-cnr', 'drag-cnr br-cnr'];
class DragContainer {
    constructor(el, className=null) {
        this.controled = el;
        this.pos1 = el.offsetLeft;
        this.pos2 = el.offsetTop;
        this.pos3 = 0;
        this.pos4 = 0;

        this.draggers = [];
        if (Array.isArray(className)) className.forEach(cl => this.addDragger(cl));
        else if (className)this.addDragger(className);

        if (this.controled?.id) this.getStoredPosition(this.controled.id)
        this.observer = new MutationObserver(() => this.inViewport())
        this.observer.observe(this.controled, {
            attributes: true,
            attributeFilter: ['class']
        });

        this.animationFrame = null;
    }

    getStoredPosition = (id) => {
        let page = window.location.pathname.split("/").pop();
        let style = JSON.parse(localStorage.getItem(`${page}#${id}`)) || {};
        if (style !== {}) {
            Object.entries(style).forEach(([k, v]) => {this.controled.style[k] = v })
        }
        window.requestAnimationFrame(() => this.inViewport());
    }

    addDragger(className) {
        const dragger = document.createElement("div");
        dragger.className = className;
        this.draggers.push(dragger);
        this.controled.appendChild(dragger);
        this.setupDrag(dragger);
    }

    rerder() {
        const els = [
            ...new Set (
                Array(
                    ...document.querySelectorAll("." + this.draggers[0].classList[0])   // drg
                ).map( e => e.parentElement))];
        els.sort(
            (a, b) => {
                const _a = parseInt(
                    window.getComputedStyle(a).zIndex, 10
                );
                const _b = parseInt(window.getComputedStyle(b).zIndex, 10);
                return (isNaN(_a) ? 0 : _a) - (isNaN(_b) ? 0 : _b);
            });

        els.forEach((el, i) => {
            el.style.setProperty('z-index', i);
        });
        this.controled.style.setProperty('z-index', els.length+1);
    }

    setupDrag(dragger) {
        dragger.onpointerdown  = (
            (ev) => {
                ev.preventDefault();
                this.rerder()
                this.controled.style.borderColor = 'green'
                this.pos3 = ev.clientX;
                this.pos4 = ev.clientY;

                document.onpointermove  = (e) => {
                    this.latestEvent = e;
                    if (!this.animationFrame) {
                        this.animationFrame = requestAnimationFrame(this.elementDrag.bind(this));
                    }
                };
                document.onpointerup = this.closeDragElement.bind(this);

            }
        ).bind(this);
    }

    elementDrag() {
        // ev.preventDefault();
        const ev = this.latestEvent;
        this.animationFrame = null;

        this.animationFrame = null;
        this.pos1 = this.pos3 - ev.clientX;
        this.pos2 = this.pos4 - ev.clientY;
        this.pos3 = ev.clientX;
        this.pos4 = ev.clientY;

        this.controled.style.left = (this.controled.offsetLeft - this.pos1) + "px";
        this.controled.style.top  = (this.controled.offsetTop  - this.pos2) + "px";
    }

    closeDragElement() {
        document.onpointerup = null;
        document.onpointermove = null;
        this.animationFrame = null;
        this.controled.style.borderColor = ''
        if (this.controled?.id !== "undefined") {
            let page = window.location.pathname.split("/").pop();
            localStorage.setItem(`${page}#${this.controled.id}`, JSON.stringify({left: this.controled.offsetLeft + 'px', top: this.controled.offsetTop + 'px'}));
        }
    }

    inViewport() {
        const rect = this.controled.getBoundingClientRect();
        const use_width = window.innerWidth || document.documentElement.clientWidth;
        const use_height = window.innerHeight || document.documentElement.clientHeight;
        const out = {
            top: rect.top < 0,
            left: rect.left < 0,
            bottom: rect.bottom > use_height,
            right: rect.right > use_width
        }
        let label;
        if (out.left)           this.controled.style.left = '15px';
        else if (out.right)     this.controled.style.left = (use_width  - this.controled.offsetWidth - 15) + 'px';
        if (out.top)            this.controled.style.top = '15px';
        if (out.bottom)         this.controled.style.top = (use_height  - this.controled.offsetHeight - 15) + 'px';
    }
}

export function makeDraggable(containers) {
    return Array.from(containers).map(el => new DragContainer(el, draggerClassList));
}