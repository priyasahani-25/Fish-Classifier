var classifierInitialized = false;
Module.onRuntimeInitialized = function() {
    classifierInitialized = true;
};

class EdgeImpulseClassifier {
    _initialized = false;
    init() {
        if (classifierInitialized === true) return Promise.resolve();
        return new Promise((resolve) => {
            Module.onRuntimeInitialized = () => {
                resolve();
                classifierInitialized = true;
            };
        });
    }
    classify(rawData, debug = false) {
        if (!classifierInitialized) throw new Error('Module is not initialized');
        const obj = this._arrayToHeap(rawData);
        let ret = Module.run_classifier(obj.buffer.byteOffset, rawData.length, debug);
        Module._free(obj.ptr);
        
        if (ret.result !== 0) {
            throw new Error('Classification failed (err code: ' + ret.result + ')');
        }
        
        let jsResult = {
            anomaly: ret.anomaly,
            results: []
        };
        
        // Support for standard Image Classification
        if (ret.classification) {
            for (let cx = 0; cx < ret.classification.size(); cx++) {
                let c = ret.classification.get(cx);
                jsResult.results.push({ label: c.label, value: c.value });
            }
        }
        
        // Support for Object Detection (FOMO)
        if (ret.bounding_boxes) {
            for (let cx = 0; cx < ret.bounding_boxes.size(); cx++) {
                let c = ret.bounding_boxes.get(cx);
                // FOMO passes back the label, confidence, and the box coordinates!
                jsResult.results.push({ label: c.label, value: c.value, x: c.x, y: c.y, width: c.width, height: c.height });
            }
        }
        
        return jsResult;
    }
    _arrayToHeap(data) {
        let typedArray = new Float32Array(data);
        let numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
        let ptr = Module._malloc(numBytes);
        let heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, numBytes);
        heapBytes.set(new Uint8Array(typedArray.buffer));
        return { ptr: ptr, buffer: heapBytes };
    }
}
window.EdgeImpulseClassifier = EdgeImpulseClassifier;
