$(document).ready(function () {


    /* **** scrollIt ***** */
    $(function () {
        $.scrollIt({
            upKey: 38,
            downKey: 40,
            easing: "linear",
            scrollTime: 600,
            activeClass: "active",
            onPageChange: null,
            topOffset: -80,
        });
    });
    /* **** End scrollIt ***** */



    /* **** Navigation Toggle Start **** */
    $(".navbar-collapse a").click(function () {
        $(".navbar-collapse").collapse("hide");
    });
    /* **** Navigation Toggle End **** */

    /* **** sticky **** */
    $(window).scroll(function () {
        if ($(this).scrollTop() > 150) {
            $("header").addClass("nav-new");
        } else {
            $("header").removeClass("nav-new");
        }
    });
    /* **** sticky **** */


    /* **** Lightbox **** */
    var lightbox = $("#lightbox");
    var lightboxImg = $("#lightbox-img");

    $(".project-screenshots img").on("click", function () {
        lightboxImg.attr("src", $(this).attr("src"));
        lightbox.addClass("active");
    });

    $(".lightbox-close, #lightbox").on("click", function (e) {
        if (e.target === this) {
            lightbox.removeClass("active");
        }
    });

    $(document).on("keydown", function (e) {
        if (e.key === "Escape") lightbox.removeClass("active");
    });
    /* **** End Lightbox **** */
    
});
