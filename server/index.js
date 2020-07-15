const Koa = require('koa');
const app = new Koa();
const Router = require('koa-router');
const router = new Router();
const koaBody = require('koa-body');
const path = require('path');
const fse = require("fs-extra");
const cors = require("koa2-cors");

// 储存文件的路径
const UPLOAD_DIR = path.resolve(__dirname,"target");

//提取文件后缀
const extractSuffix = (filename) => {
    return filename.slice(filename.lastIndexOf('.'),filename.length);
}

// 读取切片内容并把它写入指定位置
const pipeStream = (chunks,chunkDir,filePath,size) => {
    return  chunks.map((chunk,index) => {
        return new Promise((resolve) => {
            // 每个切片的路径
            const chunkPath = path.resolve(chunkDir,chunk);
            //  指定位置创建可写流
            const writeStream = fse.createWriteStream(filePath,{
                start:index*size,
                end:(index+1)*size
            })
            // 读取切片文件流
            const readStream = fse.createReadStream(chunkPath);
            // 将文件流填充到上面创建的可写流
            readStream.pipe(writeStream);

            readStream.on('end',() => {
                // 读取完切片内容 删除该切片
                fse.unlinkSync(chunkPath);
                resolve();
            })
        })
    })
}

// 合并所有的切片
const mergeAllFileChunk = async (hash,filename,size) => {
    console.log(hash,filename,size)
    // 文件后缀
    const suffix = extractSuffix(filename);
    // 文件保存的路径
    const filePath = path.resolve(UPLOAD_DIR,`${hash}${suffix}`)
    // 切片所在的文件夹
    const chunkDir = path.resolve(UPLOAD_DIR,hash)
    // 读取文件夹下的所有切片
    const chunks = fse.readdirSync(chunkDir);

    // 根据下标进行排序  否则读取的切片的顺序可能不一致
    chunks.sort((a,b) => a.split('-')[1] - b.split('-')[1]);
    // 等待文件流写入成功
    await Promise.all(pipeStream(chunks,chunkDir,filePath,size));
     //移除保存切片的文件夹
    fse.rmdirSync(chunkDir);
    
}




// 使用中间件
app
.use(koaBody({
    multipart:true,
}))
.use(cors({
    origin: function (ctx) {
        return "*";
    },
    exposeHeaders: ['WWW-Authenticate', 'Server-Authorization'],
    maxAge: 5,
    credentials: true,
    allowMethods: ['GET', 'POST', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

// 上传文件
router.post('/upload',async (ctx,next) => {
    // 获取到传过来的formData数据
    const chunkFile = ctx.request.files.chunk;
    // 除了formData之外的数据
    const {filename,filehash,hash} = ctx.request.body;
    const fileDir = path.resolve(UPLOAD_DIR,filehash);
    // 判断当前文件的文件夹是否存在
    if(!fse.existsSync(fileDir)){
        // 文件夹不存在  创建文件夹
        fse.mkdirSync(fileDir);
    }
    // 将临时路径中的切片移动到对应的文件夹中

    // 移动文件到指定的文件夹
    await fse.move(chunkFile.path,`${fileDir}/${hash}`);
    ctx.response.body = '成功';
});

// 合并切片组合成文件
router.post('/merge', async (ctx) => {
    const {hash,name ,size} = JSON.parse(ctx.request.body);
    // 根据传过来的name 去目标文件夹里查找所有切片并合并它们
    await mergeAllFileChunk(hash,name,size);
    ctx.body = '成功';
});


// 检测文件是否已存在 通过文件生成的hash 对比target目录下是否存在

router.post('/check', async (ctx) => {
    const { filename,filehash } = JSON.parse(ctx.request.body);
    const suffix = extractSuffix(filename);
    const filePath = path.resolve(UPLOAD_DIR,`${filehash}${suffix}`);
    // 查找UPLOAD_DIR文件夹里有没有将要上传的文件
    if(fse.existsSync(filePath)){
        // 存在该文件 
        ctx.body = true;
    }else{
        // 不存在该文件 
        ctx.body = false;
    }
    
});



app
.use(router.routes())
.use(router.allowedMethods());
app.listen(3000,() => {
    console.log('开启')
});