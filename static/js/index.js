// VARS
const FILE_ICON = "favicon.ico";
const FILE_INDEX = "index.html";
const HEAD_FILENAME = "upload-filename"; // HTTP header to send uploading filename to server
const SSE_CLOSE = "close"; // SSE marker that connection is closed
const URL_REMOVE = "/remove/";
const URL_SSE = "/sse/";
const URL_UPLOAD = "/upload/";

// FUNCTIONS
function doList() {
  const elBtnList = document.getElementById("btnList");
  const elBtnRemove = document.getElementById("btnRemove");
  const elDisplay = document.getElementById("displayEvents");
  let ndx = 0;
  elBtnList.disabled = true;
  elBtnRemove.disabled = true;
  elDisplay.innerHTML = "";
  const source = new EventSource(URL_SSE);
  source.addEventListener("error", (evt) => {
    console.dir(evt);
    source.close();
    elBtnList.disabled = false;
    console.log(`EventSource is closed by browser on error.`);
  });
  source.addEventListener("message", (evt) => {
    const msg = evt?.data;
    console.log(`source data: ${msg}`);
    if (msg === SSE_CLOSE) {
      console.log(`EventSource is closed by server.`);
      elBtnRemove.disabled = false;
    } else {
      // add checkbox with label
      const id = `item_${ndx++}`;
      const elCheckBox = document.createElement("INPUT");
      elCheckBox.setAttribute("type", "checkbox");
      elCheckBox.setAttribute("id", id);
      elCheckBox.setAttribute("name", "filename");
      elCheckBox.setAttribute("value", msg);
      if (msg === FILE_INDEX || msg === FILE_ICON)
        elCheckBox.setAttribute("disabled", "true");
      const elLabel = document.createElement("LABEL");
      elLabel.setAttribute("for", id);
      elLabel.appendChild(document.createTextNode(msg));
      const elItem = document.createElement("LI");
      elItem.appendChild(elCheckBox);
      elItem.appendChild(elLabel);
      elDisplay.appendChild(elItem);
    }
  });
}

async function doRemove() {
  const files = [];
  const elBtnList = document.getElementById("btnList");
  const elBtnRemove = document.getElementById("btnRemove");
  elBtnList.disabled = true;
  elBtnRemove.disabled = true;
  // get checked filenames
  const elDisplay = document.getElementById("displayEvents");
  const items = elDisplay.querySelectorAll('[name="filename"]');
  for (const one of items) if (one?.checked) files.push(one.value);
  const res = await fetch(URL_REMOVE, {
    method: "POST",
    body: JSON.stringify({ files }),
  });
  if (res.ok) elDisplay.innerHTML = await res.text();
  else elDisplay.innerHTML = "Произошла какая-то ошибка.";
  setTimeout(() => {
    elDisplay.innerHTML = "";
    elBtnList.disabled = false;
    elBtnRemove.disabled = false;
    doList();
  }, 2000);
}

async function doUpload() {
  const elBtn = document.getElementById("btnUpload");
  const elUpload = document.getElementById("fileUpload");
  const elLblUpload = document.getElementById("lblUpload");
  elBtn.disabled = true;

  const file = elUpload.files[0];
  const filename = file.name;
  const encoded = btoa(unescape(encodeURIComponent(filename)));
  const res = await fetch(URL_UPLOAD, {
    method: "POST",
    headers: {
      [HEAD_FILENAME]: encoded,
    },
    body: file,
  });
  elUpload.value = "";
  if (res.ok) {
    elLblUpload.innerText = "Файл загружен.";
    setTimeout(() => {
      elLblUpload.innerText =
        "Нажмите здесь, чтобы выбрать файл для загрузки...";
    }, 2000);
    doList();
  } else {
    elLblUpload.innerText = "Произошла какая-то ошибка.";
  }
}

function fileSelected() {
  const elUpload = document.getElementById("fileUpload");
  const file = elUpload.files[0];
  if (file) {
    const elLabel = document.getElementById("lblUpload");
    elLabel.innerText = file.name;
    const elBtnUpload = document.getElementById("btnUpload");
    elBtnUpload.disabled = false;
  }
}

self.addEventListener("load", doList);
