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
    $(".lang-dropdown a").on("click", function () {
        var href = $(this).attr("href");
        var lang = href.indexOf("it/") !== -1 ? "it" : href.indexOf("zh/") !== -1 ? "zh" : "en";
        localStorage.setItem("pref_lang", lang);
    });
    /* **** End Language Switcher **** */

    /* **** sticky **** */
    var ticking = false;
    $(window).on("scroll", function () {
        if (!ticking) {
            window.requestAnimationFrame(function () {
                if ($(window).scrollTop() > 150) {
                    $("header").addClass("nav-new");
                } else {
                    $("header").removeClass("nav-new");
                }
                ticking = false;
            });
            ticking = true;
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


    /* **** FAQ Accordion **** */
    function faqOpen($item) {
        var $answer = $item.find(".faq-answer");
        $item.addClass("open");
        $item.find(".faq-question").attr("aria-expanded", "true");
        $answer.css("max-height", $answer[0].scrollHeight + "px");
    }

    function faqClose($item) {
        $item.removeClass("open");
        $item.find(".faq-question").attr("aria-expanded", "false");
        $item.find(".faq-answer").css("max-height", 0);
    }

    $(".faq-question").on("click", function () {
        var $item = $(this).closest(".faq-item");

        if ($item.hasClass("open")) {
            faqClose($item);
            return;
        }

        $(".faq-item.open").each(function () {
            faqClose($(this));
        });
        faqOpen($item);

        var question = $.trim($(this).find("span").text());
        console.log("[FAQ] Opened:", question);
        if (typeof umami !== "undefined") umami.track('faq-open', { question: question });
    });

    // First question open on load, so the section reads as answerable content.
    faqOpen($(".faq-item").first());

    // Keep open answers correctly sized when the text reflows.
    $(window).on("resize", function () {
        $(".faq-item.open").each(function () {
            var $answer = $(this).find(".faq-answer");
            $answer.css("max-height", $answer[0].scrollHeight + "px");
        });
    });
    /* **** End FAQ Accordion **** */

    /* **** Conversion — Let's Talk clicks **** */
    function gtag_report_lets_talk() {
        if (typeof gtag !== "undefined") {
            gtag('event', 'conversion', {
                'send_to': 'AW-822472418/K3l6CPWfqLAcEOLdl4gD',
                'value': 1.0,
                'currency': 'EUR'
            });
        }
    }
    $('[data-scroll-nav="1"], .nav-btn').on("click", function () {
        console.log("[Tracking] Let's Talk clicked", this);
        gtag_report_lets_talk();
        if (typeof umami !== "undefined") umami.track('lets-talk-click');
    });
    /* **** End Conversion — Let's Talk clicks **** */

    /* **** Conversion — Calendly clicks **** */
    function gtag_report_calendly() {
        if (typeof gtag !== "undefined") {
            gtag('event', 'conversion', {
                'send_to': 'AW-822472418/TFkuCPifqLAcEOLdl4gD',
                'value': 1.0,
                'currency': 'EUR'
            });
        }
    }
    $('.btn-calendly-big, .contact-channel[href*="calendly"]').on("click", function () {
        console.log("[Tracking] Calendly clicked", this);
        gtag_report_calendly();
        if (typeof umami !== "undefined") umami.track('calendly-click');
    });
    /* **** End Conversion — Calendly clicks **** */

    /* **** Umami — Form partial fill **** */
    var _formStarted = false;
    $("#contact-form input, #contact-form textarea").on("focus", function () {
        if (!_formStarted) {
            _formStarted = true;
            if (typeof umami !== "undefined") umami.track('form-started');
        }
    });
    /* **** End Umami — Form partial fill **** */

    /* **** Umami — Section visibility **** */
    if (typeof IntersectionObserver !== "undefined") {
        var _seenSections = {};
        var _sectionMap = [
            { selector: ".banner-wrapper", name: "hero" },
            { selector: ".nice-meet-wrp",  name: "about" },
            { selector: "#selected-work",  name: "selected-work" },
            { selector: ".faq-wrp",        name: "faq" },
            { selector: "#lets-talk",      name: "contact" }
        ];
        var _sectionObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    var name = entry.target._umamiSection;
                    if (name && !_seenSections[name]) {
                        _seenSections[name] = true;
                        if (typeof umami !== "undefined") umami.track('section-view', { section: name });
                    }
                }
            });
        }, { threshold: 0.3 });
        _sectionMap.forEach(function (item) {
            var el = document.querySelector(item.selector);
            if (el) {
                el._umamiSection = item.name;
                _sectionObserver.observe(el);
            }
        });
    }
    /* **** End Umami — Section visibility **** */

    /* **** Contact Form **** */
    $("#contact-form").on("submit", function (e) {
        e.preventDefault();
        var $form = $(this);
        var $btn = $form.find("button[type=submit]");
        var $feedback = $("#form-feedback");
        var originalHtml = $btn.html();

        $btn.prop("disabled", true).html('<i class="fas fa-spinner fa-spin fa-fw"></i>');
        $feedback.hide().removeClass("form-success form-error");

        console.log("[ContactForm] Submitting to:", $form.attr("action"));
        console.log("[ContactForm] Data:", $form.serialize());

        $.ajax({
            url: $form.attr("action"),
            method: "POST",
            data: $form.serialize(),
            dataType: "json",
            success: function (res, textStatus, xhr) {
                console.log("[ContactForm] Response status:", xhr.status);
                console.log("[ContactForm] Response body:", res);
                if (res && res.success) {
                    $feedback.text($feedback.data("success"))
                             .addClass("form-success").fadeIn();
                    $form[0].reset();
                    if (typeof turnstile !== "undefined") turnstile.reset();
                    // Google Ads conversion — form submitted
                    if (typeof gtag !== "undefined") {
                        gtag('event', 'conversion', {
                            'send_to': 'AW-822472418/abVcCMnH2LAcEOLdl4gD'
                        });
                    }
                    if (typeof umami !== "undefined") umami.track('form-submitted');
                } else {
                    console.warn("[ContactForm] Server returned success=false, reason:", res && res.reason);
                    $feedback.text($feedback.data("error"))
                             .addClass("form-error").fadeIn();
                }
            },
            error: function (xhr, textStatus, errorThrown) {
                console.error("[ContactForm] AJAX error:", textStatus, errorThrown);
                console.error("[ContactForm] Response status:", xhr.status);
                console.error("[ContactForm] Response text:", xhr.responseText);
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
