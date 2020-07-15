const ajax = ({
    url,
    data,
    methods,
    onProgress
}) => {
    return new Promise((resolve,reject) => {
        let xhr = new XMLHttpRequest();
        // xhr.withCredentials = true;
        xhr.open(methods,url,true);
        xhr.upload.onprogress = onProgress; //上传的progress事件
        xhr.onerror = (e) => {
            reject(e);
        }
        xhr.onload = () => {
            resolve(xhr.responseText);
        }
        xhr.send(data);
        
        
    })
}