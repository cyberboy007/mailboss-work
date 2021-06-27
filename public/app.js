function on_click(){
  var editor = document.querySelector('.ql-editor');
  console.log(editor.innerHTML);
  document.getElementById('htmlContent').value = editor.innerHTML;
}

var buttons = document.querySelectorAll('.drop');

for (var i = 0; i < buttons.length; i++) {
  buttons[i].addEventListener('click',on_click);
}


// document.getElementById("form").addEventListener("click", function(event){
//   event.preventDefault()
// });
