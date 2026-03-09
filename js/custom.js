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

    /* **** Language Switcher **** */
    $(".lang-current").on("click", function (e) {
        e.stopPropagation();
        $(this).closest(".lang-switcher").toggleClass("open");
    });
    $(document).on("click", function () {
        $(".lang-switcher").removeClass("open");
    });
    /* **** End Language Switcher **** */

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


    /* **** Contact Form **** */
    $("#contact-form").on("submit", function (e) {
        e.preventDefault();
        var $form = $(this);
        var $btn = $form.find("button[type=submit]");
        var $feedback = $("#form-feedback");
        var originalHtml = $btn.html();

        $btn.prop("disabled", true).html('<i class="fas fa-spinner fa-spin fa-fw"></i>');
        $feedback.hide().removeClass("form-success form-error");

        $.ajax({
            url: $form.attr("action"),
            method: "POST",
            data: $form.serialize(),
            dataType: "json",
            success: function (res) {
                if (res && res.success) {
                    $feedback.text($feedback.data("success"))
                             .addClass("form-success").fadeIn();
                    $form[0].reset();
                } else {
                    $feedback.text($feedback.data("error"))
                             .addClass("form-error").fadeIn();
                }
            },
            error: function () {
                $feedback.text($feedback.data("error"))
                         .addClass("form-error").fadeIn();
            },
            complete: function () {
                $btn.prop("disabled", false).html(originalHtml);
            }
        });
    });
    /* **** End Contact Form **** */
    
});
