var spoilers = document.querySelectorAll(".spoiler");
for(var i=0; i<spoilers.length; i++) {
    var spoiler = spoilers[i];
    spoiler.addEventListener("click", e => {
        spoiler.classList.add("uncover");
    });
}