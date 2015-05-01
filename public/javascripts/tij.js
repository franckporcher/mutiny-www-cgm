/*
 * tij.js -- Journal Tahiti Info Odyssey News Reader (XML/XSLT/HTML rendering engine)
 *
 * Copyright (C) 2013,2014 Franck Porcher, Francky's Engineering <franck.porcher@franckys.com>
 * All rights reserved
 *
 * Version: $Id$
 */

/*
 *---------------------------------------------------------
 * The TIJ module/namespace
 *---------------------------------------------------------
 *          TIJ.start()
 *          TIJ.display_summary_cb().call(img+_context)
 *          TIJ.display_fulltext(rank)
 *---------------------------------------------------------
 */
var TIJ;
TIJ = (
function ($) {
    "use strict";

    /**
     * TESTING 
    var debug = function() {
        var hid1=$("#logo").kbdRegister(
            ['A', 'Z'],
            function(keycode){ console.log(" key pressed:" + keycode + ' in #logo zone') },
            { 'MAJ': true }
        );

        var hid2=$.kbdRegister(
            ['ENTER'],
            function(keycode){ console.log("Enter pressed:" + keycode + ' anywhere') }
        );
    };
     */


    /**
     * GUI events : monitoring async critical sections for smooth operations
     */
    var GUI_TOKEN = true,
        GUI_DFD,
        GUI_TOKEN_reset = function() {
            //console.log('[GUI_TOKEN] RESOLVED');
            GUI_TOKEN = true;
            GUI_DFD.resolve(true);
        },
        GUI_TOKEN_get = function() {
            if (GUI_TOKEN) {
                //console.log('[GUI_TOKEN] TAKEN');
                GUI_TOKEN = false;
                GUI_DFD = $.Deferred();
                $.when( GUI_DFD ).always( GUI_TOKEN_reset );
                return GUI_DFD;
            }
            //console.log('[GUI_TOKEN] NOT AVAILABLE');
            return false;
        },


    /**
     * Factories
     */
        m_hide           = $.prototype.hide,
        m_show           = $.prototype.show,
        m_fadeIn         = $.prototype.fadeIn,
        m_fadeOut        = $.prototype.fadeOut,
        m_slideUp        = $.prototype.slideUp,
        m_slideDown      = $.prototype.slideDown,
        resolve_dfd      = function(s) { this.resolve(s===undefined ? true : s); },
        shfactory        = function(o,m,d,f) { // Show/hide factory (object, method, duration(default 'fast'))
            return function(){ // transmit dfd to custom functions thru 'this'
                var dfd = $.Deferred();
                m.call(o, d||'fast', (f||resolve_dfd).bind(dfd));
                //if (msg) { console.log('[shfactory] ' + msg + ' DFD -->' + dfd); }
                return dfd;
            };
        },
        animatefactory   = function(o,feature,d,f/*,msg*/) { // Animate feature(object, feature::obj, duration(default 'fast'))
            return function() { // transmit dfd to custom functions thru 'this'
                var dfd = $.Deferred();
                //if (msg) { console.log('[animatefactory] ' + msg); }
                o.animate(feature, {duration: d||'fast', complete: (f||resolve_dfd).bind(dfd)} );
                return dfd;
            };
        },


    /**
     * Facebook social plugin JavaScript SDK
     *
     * So here you can programmatically request the good language
        load_fbjssdk_complete = function() {
            TIJ.console('FACEBOOK DONE !');
        },

        load_fbjssdk = function() {
            TIJ.console('Enabling FACEBOOK');
            return;
            if ( ! state.scripts.fbjssdk ) {
                state.scripts.fbjssdk = true;

                window.fbAsyncInit = function() {
                    FB.init({
                        appId      : '444660685678724',
                        status     : true,
                        xfbml      : true
                    });
                };

                var script    = $('#facebook-jssdk')[0];
                script.async  = true;
                script.src    = "http://connect.facebook.net/fr_FR/all.js#xfbml=1";
                script.onload = load_fbjssdk_complete;
            }
        },
     */


    /**
     * Misc data
     */
        console_timer_id = null,


    /**
     * Search engine data
     */
        sh_n,
        sh_nodes   = [],
        sh_options = {},
        sh_regexp,
        sh_foo = function(str_match){ 
            sh_n++;
            if ( sh_options['regex'] ) {
                return '<span class="searchres">' + str_match + '</span>';
            }
            return str_match.replace(sh_regexp, '<span class="searchres">$&</span>');
        },

    /**
     * Application vars & widgets
     */
        // LOCAL STORAGE
        hasLocalStorage=false,
        JID,                // Journal uniq id (MD5)
        LS_JTI_KEY,
        LS_JID_KEY,
        LS_TAGS_KEY,
        // BOOKMARKS
        default_bmtag = 'Toutes rubriques',
        ls_bmtags     = {}, // { tag => tag }
        LS_BOOKMARKS_KEY,
        bm_keys_hash  = {}, // {"onr.jti.<md5id>.<rank> (full LS key), ...}
        bm_local_keys = {}, // { local_lskey -> DIV }
        bm_section_n  = 1,
        bm_section_id = {}, // {"<tag>": <bm_section_id>}
        bm_data_n     = 1,
        bm_data_id    = {}, // {"<md5id>.<rank>": <bm_data_id>}
        //bm_pattern_section = '<div class="bm_section" id="{0}"><div class="bm_tag">{1}</div></div>',
        bm_pattern_section = '<div class="bm_section" id="{0}"><fieldset><legend>{1}</legend></fieldset></div>',
        //bm_pattern_data = '<div class="bm_data" id="{0}" section="{1}"><div class="bm_title">{3} <span class="bm_date">({2})</span></div><div class="bm_rm" id="{4}" lskey="{5}"></div></div>',
        bm_pattern_data = '<div class="bm_data {4}" id="{0}" section="{1}"><div class="bm_title">{3} <span class="bm_date">({2})</span></div><div class="bm_rm"></div></div>',
        $bm,
        $bm_open,
        $bm_close,
        $bm_win_link,
        $bm_overlay,
        $bm_tag,
        $bm_note,
        $bm_taglist,

        $tooltip,
        $internet_bw,
        $nbdisp,
        $console,
        $sh_open,
        $sh_close,
        $sh_lookup,
        $sh_opts,
        $sh_cats,
        $sh_go,
        $sh_bot,
        $internet,
        $prefetch,
        $rubmode,
        $tij_header,
        $tij_journal_accordion,
        $tij_header,
        $mod,
        $html,
        $htmlbody,
        $jqwindow,
        $articles_zone,     // délimite la zone en propre des articles pour les évènements claviers

        initialize_vars_widgets = function() {
            JID              = $('body')[0]['id'];
            LS_JTI_KEY       = 'onr.jti.';
            LS_TAGS_KEY      = LS_JTI_KEY + 'tags';
            LS_BOOKMARKS_KEY = LS_JTI_KEY + 'bookmarks';
            LS_JID_KEY       = LS_JTI_KEY + JID + '.';
            $bm              = $('#bm');
            $bm_open         = $('#bm_open');
            $bm_close        = $('#bm_close');
            $bm_win_link     = $('#bm_win_link');
            $bm_overlay      = $('#bm_overlay');
            $bm_tag          = $('#bm_tag');
            $bm_note         = $('#bm_note');
            $bm_taglist      = $('#bm_taglist');
            $tooltip         = $('#tooltip');
            $mod             = $('#mod');
            $internet_bw     = $('#internet_bw');
            $nbdisp          = $('#nbdisp');
            $console         = $('#tij_console');
            $sh_open         = $('#sh_open');
            $sh_close        = $('#sh_close');
            $sh_lookup       = $('#sh_lookup');
            $sh_opts         = $('#sh_opts');
            $sh_cats         = $('#sh_cats');
            $sh_go           = $('#sh_go');
            $sh_bot          = $('#sh_bot');
            $internet        = $('#internet');
            $prefetch        = $('#prefetch');
            $rubmode         = $('#rubmode');
            $tij_header      = $('#tij_header');
            $tij_journal_accordion = $('#tij_journal_accordion');
            $tij_header      = $('#tij_header');
            $html            = $('html');
            $htmlbody        = $('html, body');
            $jqwindow        = $(window);
            $articles_zone   = $('#tij_header, #bm_tag, #bm_note').kbdNegz(); // C'est ni l'en-tête, ni le bookmark

            hasLocalStorage  = ('localStorage' in window) && window['localStorage'] !== null;
        },

    /**
     * RANK(mkjournal articles ordering) -> TABNUM (Accordion tab ordering)
     */
        rank_to_tabnum       = [],

    /**
     * Journal-wide state vector (private)
     */
        state = {
          scripts: {}, // ex script:{ fb_jsssdk: true }

          display:    {
            summary:    { // rank:   { done:   true/false, loaded: true/false }
            },
            fulltext: { // idem
            },
            current: {
                article: null,
                rubidx: -1, // INdex of current rubrique opened in 'rublist'
                artidx: -1  // Current opened article
                }
          },

          // Liste des images de l'application (pour prefetch)
          img: {}, // rank: {summary: imgsrc, body: [img_src...]}

          // Liste des titres des articles (pour le bookmarking / localstorage)
          titles: {}, // rank =>  article's title(format text)
          
          // Titre de la rubrique associée aux articles (pour le bookmarking / localstorage)
          bmrub: {}, // rank =>  Titre Rubrique(format text)

          // Navbutton associé aux articles
          navbutton: {}, // rank => navbutton (DOM) 
            
          // Keep track of which article's posts were expanded or not
          expanded_posts :        {}, // <rank>     --> true/false

          //navbar      
          navbar: {
            internet:   false,
            prefetch: false,

            rubbar:     {
                toggle_duration:    200,

                button: {
                    rublist: ['catpf', 'catpac', 'catnf', 'catnm', 'catdep', 'catmag', 'catsport', 'catpa', 'catsearch' ],
                    list:    [],    // Rubrique-bar DOM button elements

                    catpf: {
                        selected: false,
                        cssclass: 'news tahiti'
                        /*   articles: [],     //list of articles for the topic
                           jqArticles: null,   //same but with jQueried elts
                               button: null,   //DOM widget associated to topic
                             jqButton: null,   //same jQueried
                       posts_expanded: false   //Are posts expanded for this topic yest ?
                       */
                    },
                    catpac: {
                        selected: false,
                        cssclass: 'news pacifique'
                    },
                    catnf: {
                        selected: false,
                        cssclass: 'news france'
                    },
                    catnm: {
                        selected: false,
                        cssclass: 'news monde'
                    },
                    catdep: {
                        selected: false,
                        cssclass: 'depeche'
                    },
                    catmag: {
                        selected: false,
                        cssclass: 'magazine'
                    },
                    catsport: {
                        selected: false,
                        cssclass: 'sport'
                    },
                    catpa: {
                        selected: false,
                        cssclass: 'annonce'
                    },
                    catmisc: {
                        selected: false,
                        cssclass: 'misc'
                    },
                    catsearch: {
                        selected: false,
                        cssclass: 'search'
                    }
                },

                mode: {
                    selected:   'exclusif',
                    exclusif:   {
                        toggle:     'additif',
                        // V1(colored background) cssclass:   'exclusif setbg'
                        cssclass:   'exclusif'
                    },
                    additif: {
                        toggle:     'exclusif',
                        // V1(colored background) cssclass:   'additif setbg'
                        cssclass:   'additif'
                    }
                }
            }
          }
        },

        /**
         * TOOLTIP
         */
        tt_pos,         // = $tooltip.offset(),
        tt_id     = '', // Zone triggering the tooltip
        tt_timer  = '',
        tt_active = false,
        tt_X,
        tt_Y,

        // DISPLAY TOOLTIP if mouse remained iddle for 400ms
        tt_display = function() {
            tt_timer    = '';
            tt_active   = true;
            tt_pos.top  = tt_Y;
            tt_pos.left = tt_X;
            $tooltip.offset(tt_pos).animate({opacity: 0.91},{duration: 'fast'});
        },

        // HIDE TOOLTIP
        tt_hide = function() {
            //console.log('[TT OUT] inzone:' + inzone + ' id:' + tt_id + ' oid:' + tt_oid);
            //  tooltip did not stay in the same zone long enough 
            //  to be started. We just cancel the timer
            if ( tt_timer  ) clearTimeout( tt_timer );
            if ( tt_active ) {
                $tooltip.animate({opacity: 0},{duration: 'fast'});
                return tt_id = undefined; // to prevent further redisplaying the tt 
            }
            return true;
        },

        // To keep correct coordinates
        tt_mouse = function(event) {
            event.stopPropagation();
            if (tt_id && tt_hide() ) {
                tt_X     = event.pageX + 12;
                tt_Y     = event.pageY + 13;
                tt_timer = setTimeout( tt_display, 400);
            }
        },
                
        tt_hover =  function(event) {
            event.stopPropagation();
            tt_id     = this.id;
            tt_active = false;
                    
            // Get the tooltip ready
            $tooltip.html( state.tt[ tt_id ] );

            // Get the initial position ready too!
            tt_X     = event.pageX + 12;
            tt_Y     = event.pageY + 13;
                    
            // Set the timer...
            tt_timer = setTimeout( tt_display, 400);
        },

        /**
        * BOOKMARK GETTER & SETTER
        */
        $bm_dfd,
        restore_bmtags = function() {
            var l  = localStorage[LS_TAGS_KEY].split('|').sort(),
               len = l.length,
                 i = 0,
               tag;
            $bm_taglist.empty();
            for (; i < len; i++) {
                tag = l[i];
                ls_bmtags[tag] = tag;
                $bm_taglist.append('<option value="' + tag + '" />');
            }
        },

        add_bmtags = function(tag) {
            if ( ! ls_bmtags[tag] ) {
                ls_bmtags[tag] = tag;
                localStorage[LS_TAGS_KEY] = $.keys(ls_bmtags).join('|');
                restore_bmtags();
            }
        },

        bm_overlay_close = function() {
            $bm_overlay.fadeOut('fast', resolve_dfd.bind($bm_dfd) )
        },

        get_bmtag = function(rank) {
            var dfd = $.Deferred();
            $bm_dfd = $.Deferred();
            $bm_tag[0].value = '';
            $bm_note[0].value = '';
            // Show form to input tag and note
            $bm_overlay.fadeIn('fast');
            $.when( $bm_dfd ).always( function() {
                // Default tag is tha article's rubrique
                var tag = $bm_tag[0].value || state.bmrub[rank];
                dfd.resolve(tag);
                add_bmtags(tag);
            });
            return dfd;
        },


    /**
     * Transparent PNG image
     */
        noimg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAKCAYAAAD2Fg1xAAAAF0lEQVQ4y2NgGAWjYBSMglEwCkbB8AEAB9oAAQS2MjwAAAAASUVORK5CYII='

    ; /* END variable declaration -- /!\ DO NOT REMOVE ';' */


    /**
     * Estimate client bandwidth, for auto self calibrating
     * and prefetch dimensioning
     * 
     * Using /upload.wikimedia.org/wikipedia/commons/5/51/Google.png
     * or
     * http://lorempixel.com/800/600/nature/Dummy-text

     * Utilisation : estimate_bandwidth(10, function(e){ console.log(e) });
     *
     * /!\ ASYNC => Returns a promise, which will be called with bandwidth
     *
     */
    var estimate_bandwidth = function(count) {
        $.ajaxSetup({ timeout: 3000 });

        var dfd           = $.Deferred(),
            // url        = 'http://lorempixel.com/800/600/nature/4/{0}-{1}';
            // img_size_byte = 141607;
            url           = 'http://upload.wikimedia.org/wikipedia/commons/5/51/Google.png?{0}{1}',
            img_size_byte = 243397,

            latency       = 0,
            start_time    = (new Date()).getTime(),  //ms
            i             = 0,
            total_time    = 0,
            img           = new Image();

        var rec           = function() {
            img.src       = TIJ.ssprintf( url, start_time, i );
        };

        img.onerror       = function(e) {
            dfd.resolve(0);
        };

        img.onload       = function(){
            // We discard the 1st try, which always take longer...
            var load_time   = (new Date()).getTime() - start_time; //ms
            //console.log('[Bandwidth] #' + i + ': ' + load_time + 'ms');

            // See what we get from the initial round
            if ( i == 0 ) {
                if ( load_time > 12000 ) {
                    // 256 Kbps or bad 512Kbps
                    dfd.resolve( ((img_size_byte * 8) / ((load_time/2) - latency)).toFixed(0) ); 
                    return;
                }

                if ( load_time > 8000 ) {
                    // 512K . We limit count to 1 (another round)
                    count = 1;
                }
            }
            else {
                total_time += load_time - latency;
            }

            // Compute BANDWIDTH HERE
            if (i == count) {
                // En faisant l'approximation 1Ko = 1000 octets
                // on évite la division pour avoir la
                // vitesse en K/s car bits/ms == Kbits/s
                dfd.resolve( ((i * img_size_byte * 8) / total_time).toFixed(0) ); 
            }
            else {
                i++;
                start_time = (new Date()).getTime();
                rec();
            }
        };

        var compute_latency = function() {
            var dfd        = $.Deferred(),
                img        = new Image(),
                start_time = (new Date()).getTime();

            img.onerror    = function() {
                dfd.resolve( (new Date()).getTime() - start_time );
            };

            // wrong URL
            img.src = 'http://upload.wikimedia.org/wikipedia/commons/5/51/Googles.png';

            return dfd;
        };

        $.when( compute_latency() ).always(function(lag) {
            //console.log('[Bandwidth] Latency:' + lag);
            latency = lag;
            rec();
        });

        return dfd;
    },


    /**
     * generate_accordion_tabs()
     *
     * <div class="h1"
     *    o="owl"           Ex 'regional tahiti'
     *    r="rank"             52
     *    d="dmy"              25/02/2014
     *    v="nb_visits"        14
     *    p="nb_posts">        0
     *   TITRE...
     * </div>
     *
     *  === transform ==>
     *
     *  <h1 id="tabnum_<tabnum>" class="regional tahiti">  rank makes the link to the article's div
     *      <a>
     *          <span class="setbg @t">
     *              <span>@dmy</span>
     *          </span>
     *          "Incendie du stock de carburant de la centrale EDT de Punaruu" (exercice de sécurité)
     *          <span class="b">
     *      </a>
     *      <div class="bookmk off/on" rank="rank"></div> Only if localstorage is supported
     *      <div class="comlu" rank="<rank>">
     *        <div class="comment">
     *          <a class="clink" 
     *             id="clink_<tabnum>_<rank> > !!! V1/V2 (obsolete)
     *             id="clink_<rank> >          ! V3 (current) use rank_to_tabnum array
     *             href="#BOP_<rank>" >
     *             3 commentaires
     *          </a>
     *        </div>
     *        <div class="lu">
     *          lu 1234 fois
     *        </div>
     *      </div>
     *   </h1>
     *
     *   Handle localStorage
     */
        generate_accordion_tabs = function() {
        var tabnum = 0;

        var h1_list = $('div.h1').toArray(),
                  i = 0,
                len = h1_list.length,
                div,
                owl,
                rank,
                dmy,
                lu,
                nposts,
                title,
                lu_post,
                mark_article = '';

        for ( ; i < len; i++) {
            div    = $( h1_list[i] );
            owl    = div.attr('o');
            rank   = div.attr('r');
            dmy    = div.attr('d');
            lu     = div.attr('v');
            nposts = div.attr('p');
            title  = div.html();
            lu_post = lu > 0
            ? TIJ.ssprintf(
                 '<div class="comlu" rank="{2}"><div class="comment">{0}</div><div class="lu">Lu {1} fois</div></div>',
                  nposts > 0
                    ? TIJ.ssprintf( 
                        //'<a class="clink" href="#BOP_{1}" id="clink_{0}_{1}">{2} commentaire{3}</a>',
                        //tabnum,
                        //'<a class="clink" href="javascript:void 0#BOP_{0}" id="clink_{0}">{1} commentaire{2}</a>',
                        '<a class="clink" href="javascript:void 0;" id="clink_{0}">{1} commentaire{2}</a>',
                        rank,
                        nposts,
                        nposts > 1 ? 's' :  ''
                      )
                    : '',
                  lu,
                  rank
              )
            : '<div rank="' + rank + '"></div>' ;

            /* Add Bookmarking if browser supports localStorage (class "bookmk") */
            if (hasLocalStorage) {
                mark_article = '<div class="bookmk off" dmy="' + dmy + '" rank="' +  rank + '"></div>';
                state.titles[rank] = div.text();
            }

            /* DO NOT REMOVE the class 't', which allows many effect and features to take place*/
            div.replaceWith( 
                TIJ.ssprintf(
                    //'<h1 id="tabnum_{4}" class="{0}" name="{5}"><a><span class="setbg {0}"><span class="dmy">{1}</span></span>{2}</a>{6}{3}</h1>',
                    '<h1 id="tabnum_{4}" class="{0}" name="{5}"><a><span class="setbg {0}"><span class="dmy">{1}</span></span>{6}{2}</a>{3}</h1>',
                    owl,
                    dmy,
                    title,
                    lu_post,
                    tabnum,
                    rank,
                    mark_article
                )
            );

            // Rank ->  Tabnum association
            rank_to_tabnum[rank] = tabnum;

            tabnum++;
        }
    },


    /**
     * generate_articles_header()
     *
     *
     *  <div   class="art_head"
     *         o="magazine tahiti annonce immobilier"
     *         t="Petites Annonces"
     *         d="Mardi 25 Février 2014 00:00"></div>
     *
     *  === transform ==>
     *
     *  <div class="art_head">
     *     <div class="art_head_type setbg magazine tahiti annonce immobilier">
     *        Petites Annonces
     *     </div>
     *     <div class="art_head_date setfg magazine tahiti annonce immobilier">
     *        Mardi 25 Février 2014 00:00
     *     </div>
     *  </div>
     */
        generate_articles_header = function() {
        var art_head_list = $('div.art_head').toArray(),
                        i = 0,
                      len = art_head_list.length,
                      div;

        for (; i < len; i++) {
            div  = $( art_head_list[i] );

            div.replaceWith( 
                TIJ.ssprintf(
                    '<div class="art_head"><div class="art_head_type setbg {0}">{1}</div><div class="art_head_date setfg {0}">{2}</div></div>',
                    div.attr('o'),
                    div.attr('t'),
                    div.attr('d')
                )
            );
        }
    },


    /**
     * generate_articles_summary()
     *
     *
     *  <div   class="art_summary"
     *         r="200"
     *         o="magazine tahiti annonce immobilier"
     *         s="file://localhost/home/fpo/TI/images/annonce-15627223.jpg?v=1393288927">
     *             PAMATAI, dans un environnement paisible, à quelques minutes de Papeete et de l'Aéroport, un appartement de type F1 d'environ 30m² + une terrasse couverte, un jardinet clos avec 1 boxe couvert. Idéal pour une première Acquisition ou un pied-à-terre avec un petit budget. En bon état général. A saisi...
     *  </div>
     *
     *  === transform ==>
     *
     *  <div class="art_summary" id="art_summary_200">
     *     <div class="art_summary_text" id="art_ummary_text_200">
     *        <div class="art_summary_img" id="art_summary_img_200" rank="200">
     *           <img src="data:image/..."
     *             name="file://localhost/home/fpo/TI/images/annonce-15627223.jpg?v=1393288927"
     *             id="art_summary_img_img_200" 
     *             class="lazy h60 setborder magazine tahiti annonce immobilier">
     *        </div>
     *        SUMARY...
     *       <a class="moretext setbg magazine tahiti annonce immobilier"
     *          id="moretext_200" 
     *           href="javascript:void TIJ.display_fulltext(200);">
     *       </a>
     *       <div class="spacer1"></div>
     *     </div>
     *  </div>
     */
        generate_articles_summary = function() {
        var art_summary_list = $('div.art_summary').toArray(),
                   state_img = state.img,
                           i = 0,
                         len = art_summary_list.length,
                         div,
                        rank,
                         owl,
                     img_src,
                     img_div;

        for (; i < len; i++) {
            div     = $( art_summary_list[i] );
            rank    = div.attr('r');
            owl     = div.attr('o');
            img_src = div.attr('s');
            img_div = img_src ? TIJ.ssprintf(
                '<div class="art_summary_img" id="art_summary_img_{0}" rank="{0}"><img src="{2}" name="{3}" id="art_summary_img_img_{0}" class="lazy h60 setborder {1}" /></div>',
                    rank,
                    owl,
                    noimg,
                    img_src
                ) : '';

            div.replaceWith( 
                TIJ.ssprintf(
                    '<div class="art_summary" id="art_summary_{0}"><div class="art_summary_txt">{3}<div id="art_summary_txt_{0}">{2}</div><br/><a class="moretext setbg {1}" id="moretext_{0}" href="javascript:void TIJ.display_fulltext({0});"></a><div class="spacer1"></div></div></div>',
                    rank,
                    owl,
                    div.html(),
                    img_div
                )
            );

            // Memoization, for further prefetch
            state_img[rank] = {summary: img_src, body: []};
        }
    },


    /**
     * generate_body_images(rank)
     *
     * rank   => Images for one article
     * norank => Images for ALL articles
     *
     *
     * <div class="bodyimg"
     *      s="source" 
     *      a="alt" 
     *      r="numero_de l'article(rank)"
     *      o="type(@owl)"
     *      bsn="body section number", to associate the englobing image section div
     *      />
     *
     *  === transform ==>
     *
     * <img id="art_body_section_img_<rank>_<sectionNum>#<image_number>"
     *      src="data:image/png;base64,<transparent image>"
     *     name="src image that will be fetched on demand and loaded into the *     image"
     *      alt="alt text, if any"
     *    class="lazy h300 img_set_<rank> setborder <type>"
     *  />
                    // /!\ UNIQUE ID => id = // "art_body_section_img_<rank>_<sectionNum>#<image_number>"
     */
        id_image   = 1,

        generate_body_images = function(rank) {
        var img_list = $('div.bodyimg' + ( rank ? ('[r=' + rank + ']') : '' ) ).toArray(),
                   i = 0,
                 len = img_list.length,
                 div,
                rank,
                bsn;


        for (; i < len; i++) {
            div  = $( img_list[i] );
            rank =  div.attr('r');
            bsn  =  div.attr('bsn'); // body section image number

            div.replaceWith(
                TIJ.ssprintf(
                    '<img id="{5}" src="{0}" name="{1}" alt="{2}" class="lazy h300 img_set_{3} setborder {4}" />',
                    noimg,
                    div.attr('s'),
                    div.attr('a')||'',
                    rank,
                    div.attr('o'),
                    'art_body_section_img_' + rank + '_' + bsn + '#' + id_image++
                )
                //id_image++
            );
        }

        // View images into TIJ embedded images viewer !
        var index    = 0, // index of image in set
            liveview = TIJ.lv;
        $('img.img_set_' + rank).each( function(){
            $(this).click( liveview.loadviewer.bind(liveview, rank, 'img.img_set_' + rank, index++) )
        });
    },


    /**
     * prefetch_images()
     *
     */
        prefetch_img_list   = [],
        prefetch_cache_size = 0,    // number of // download threads (1-8)
        prefetch_cache      = null, // Array of above number of Images, associated with callbacks
        prefetch_dfd        = $.Deferred(),
        prefetch_cb         = function(cache_index) {return reload_prefetch_cache.bind(cache_index) },
        prefetch_loaded     = 0,
        reload_prefetch_cache, //forward declaration

        prefetch_images = function() {
        // Initial call : build the prefetch cache
        var i;

        if ( prefetch_cache === null ) {
            prefetch_cache = new Array(prefetch_cache_size);

            for (i=0; i < prefetch_cache_size; i++) {
                var cb  = prefetch_cb(i),
                    img = new Image();

                img.onload        = cb;
                img.onerror       = cb;
                prefetch_cache[i] = img;
            }
        }

        // Initialize the prefetch cache
        for (i=0; i < prefetch_cache_size; i++) {
            if ( prefetch_img_list.length > 0 ) {
                prefetch_cache[i].onload();
            }
        }

        return prefetch_dfd.promise();
    },

    // Reload cache, the cache_index is provided by 'this' object
    reload_prefetch_cache = function() {
        if ( state.navbar.internet && state.navbar.prefetch ) {
            if ( prefetch_img_list.length > 0 ) {
                if ( prefetch_cache[this].src ) {
                    prefetch_loaded++;
                    TIJ.console( '[Prefetch] Image#' + prefetch_loaded + ': ' + prefetch_cache[this].src );
                }
                prefetch_cache[this].src = prefetch_img_list.shift();
            }
            else {
                //console.log('[PREFETCH] DONE! (cache#' + this);
                prefetch_dfd.resolve(true);
            }
        }
    },

        pre_prefetch_images = function() {
        var state_img = state.img,
             img_list = $('div.bodyimg').toArray(),
                    i = 0,
                  len = img_list.length,
                    j,
                    n,
                  div;
        //state_img{rank} = {summary: img_src, body: [imgsrc...]};

        // Génération de la liste des images des corps d'articles, par article
        for (; i < len; i++) {
            div = $( img_list[i] );
            state_img[ div.attr('r') ].body.push( div.attr('s') );
        }

        // Génère la liste de téléchargement en tâche de fond (basée sur
        // l'ordre des catégories)
        var rub_buttons      = state.navbar.rubbar.button,
            rublist          = rub_buttons.rublist,
            summary_img_list = [],
            body_img_list    = [],
            rank;

        for (i=0, len=rublist.length; i < len; i++) {
            var articles = rub_buttons[ rublist[i] ].articles;

            for (j=0, n=articles.length; j < n; j++) {
                rank = articles[j].rank;
                var summary_img = state_img[ rank ].summary;

                // Summary image, if any
                if (summary_img) {
                    summary_img_list.push( summary_img );
                }

                // Body images, if any
                body_img_list = body_img_list.concat( state_img[ rank ].body );
            }
        }

        prefetch_img_list = summary_img_list.concat( body_img_list );
    },


    /**
     * generate_body_posts(rank)
     *
     * rank     => posts for a given article
     * no-rank  => posts for ALL articles
     *
     * <div class="post"
     *    p="{ti:post_pseudo}"
     *    d="{ti:post_date}"
     *    o="numero du post"             n / o if o is not set => o = n
     *    n="number_of_posts">
     *   <xsl:value-of select="ti:text"/>
     * </div>
     *
     *  === transform ==>
     *
     * <div class="post">
     *  <div>
     *    <div class="post_header">
     *        <div class="post_pseudo"><xsl:value-of select="ti:post_pseudo"/></div>
     *        <div class="post_date"><xsl:value-of select="ti:date"/></div>
     *        <div class="post_num"><xsl:value-of select="./@rank"/> / <xsl:value-of select="./@rank"/></div>
     *    </div>
     *    <div class="post_text">
     *      <xsl:value-of select="ti:text"/>
     *    </div>
     *  </div>
     * </div>
     */
        generate_body_posts = function(rank) {
        var posts_list = $( 'div.post' + ( rank ? ('[r=' + rank + ']') : '' ) ).toArray(),
                     i = 0,
                   len = posts_list.length,
                   div, numero, nombre, rank;

        for (; i < len; i++) {
            div     = $( posts_list[i] );
            numero  = div.attr('o') || 1;
            nombre  = div.attr('n') || 1;
            rank    = div.attr('r') || 1;
            div.replaceWith(
                TIJ.ssprintf(
                    '<div class="post"><div><div class="post_header"><div class="post_pseudo">{0}</div><div class="post_date">{1}</div><div class="post_num">{2}/{3}</div></div><div class="post_text">{4}</div></div></div>',
                    div.attr('p'),
                    div.attr('d'),
                    numero,
                    nombre,
                    div.html()
                )
            );
            state.expanded_posts[rank] = true;
        }
    },

    // Pour toute une rubrique
        generate_body_posts_rubrique = function(rubrique) {
        var rubbar_button = state.navbar.rubbar.button[rubrique];

        if ( ! rubbar_button.posts_expanded ) {
            var articles = rubbar_button.articles,
                       i = 0,
                       n = articles.length,
                    rank;

            for (; i < n; i++) {
                rank = articles[i].rank;
                if ( !state.expanded_posts[rank]) {
                    generate_body_posts(rank);
                }
            }

            rubbar_button.posts_expanded = true;
        }
    },
    
    ////
    // <context>.display_fulltext_images_cb() -- Callback on article's body been loaded
    //
    // Called upon article's body's images being all loaded or broken
    //
    // 'this' is the following object context ::
    // {
    //      imagesLoaded:   imagesLoaded,
    //      jqBatch:        jqBatch,
    //      batch:          batch,
    //      lazy_class:     lazy_class,
    //      context:        { the original context passed to "lazy_loadmany()"
    //           jqSelector:  
    //           lazy_classes:  ['lazy h300'],
    //           ajax:   {
    //               done: when the batch is over
    //               fail: when one image is broken
    //           },
    //           ... custom_data (rank, etc...)
    // }
    //
        display_fulltext_images_cb = function() {
            var rank       = this.context.rank,
                art_status = state.display.fulltext[rank];
            //console.log('--> display_fulltext_cb(' + rank + ')' );

            // Updtate status
            art_status.loaded = true;
              art_status.done = true;

            return true;
        }, 


    /**
     * SUMMARY DISPLAY Accordion tab selection callback
     *
     * *MUST* resolve the DFD it receives in 'this'
     *
     */
        acc_summary_cb_cont = function(rank) {
            var dfd                     = this,
                $summary_img            = $('#art_summary_img_' + rank),
                $summary_img_is_visible = $summary_img.is(":visible"),
                sd_summary              = state.display.summary,
                resolve                 = function(tag) { 
                    if ( tag ) {
                        sd_summary[rank][tag] = true;
                    }
                    //console.log('[acc_summary_cb_cont] DFD RESOLVED');
                    dfd.resolve(true); 
                };

            //console.log('--> acc_summary_cb_cont(' + rank + ') Received DFD:' + dfd);

            // Status vector of the article's summary display
            if ( ! sd_summary[rank] ) {
                if ( $summary_img.length > 0 ) {
                    sd_summary[rank] = {
                        done:   false,
                        loaded: false
                    };
                }
                else {
                    sd_summary[rank] = {
                        done:   true,
                        loaded: false
                    };
                    $.when( TIJ.display_summary_cb(rank) )
                        .always( resolve );
                    return;
                }
            }

            var art_status = sd_summary[rank];

            if ( art_status.done ) {
                dfd.resolve(true);
            }
            else {
                if ( art_status.loaded ) {
                    if ( $summary_img_is_visible ) {
                        resolve('done');
                    }
                    else {
                        $summary_img.show('fast', resolve.bind(null, 'done'));
                    }
                }
                else {
                    // Summary's image not yet loaded
                    if ( state.navbar.internet ) {

                        // online --> load the summary image
                        var load_image = function(){ 
                                $.when(
                                    TIJ.lazy_one.call(
                                        // The Img() DOM element
                                        $('#art_summary_img_img_' + rank).get(0),

                                        // The lazy context
                                        {
                                            lazy_class:  'lazy h60', // MANDATORY
                                            ajax:   {
                                                done: TIJ.display_summary_cb.bind(null,rank),
                                                fail: TIJ.img_err_h60
                                            },
                                            rank: rank
                                        }
                                    )
                                ).always( resolve.bind(null, 'loaded') );
                            };

                        // We are online, loading photos...
                        if ( $summary_img_is_visible ) {
                            load_image();
                        }
                        else {
                            $summary_img.show('fast', load_image);
                        }
                    }
                    else {
                        // We are offline, not loading any photos, so we hide
                        // the image display, until loading is resumed
                        if ( $summary_img_is_visible ) {
                            $summary_img.hide(
                                'fast',
                                function() { $.when( TIJ.display_summary_cb(rank) ).always( resolve ); }
                            );
                        }
                        else {
                            dfd.resolve(true); 
                        }
                    }
                }
            }
        }, /* acc_summary_cb_cont() */

        acc_summary_cb = function(rank) {
            if ( rank ) {
                //console.log('--> acc_summary_cb(' + rank + ')' );
                var dfd = GUI_TOKEN_get();

                if (!dfd) {
                    // Token not available. Action cannot be performed
                    return false;
                }

                // 98 = 2 x hauteur_totale_onglet_accordeon + ecart avec le
                // haut du container du texte de l'article (12 + 20 = 32)
                // de l'article, soit 2x33 + 32 = 98
                $htmlbody //$html
                    .animate({
                        scrollTop: $('#art_container_' + rank).offset().top - $tij_header.height() - 98
                    },{
                        duration: 'slow',
                        complete: acc_summary_cb_cont.bind(dfd,rank)
                    });

                return dfd;
            }
            else {
                return false;
            }
        }, /* acc_summary_cb() */


    /**
     * DEFAULT Accordion tab selection callback
     *      Switch between summary or fulltext display
     */
        acc_default_cb = function(rank) {
            //console.log('--> acc_default_cb(' + rank + ')' );
            return (rank && state.display.fulltext[rank] ) ?  TIJ.display_fulltext(rank) : acc_summary_cb(rank);
    },


    /**
     * Accordion tab selection callback
     */
        acc_cb = acc_default_cb,


    /**
     * SELECT ARTICLE  DISPLAY Accordion tab selection callback
     * Triggered by kbd events
     *
     * /!\ ASYNC --> RETURNS A PROMISE
     *
     * 2nd argument is provided by call from accordion
     * 1st by the currying the dfd from TI.prevnext_article()
     *
     */
        acc_select_article_cb = function(dfd, rank) {
            //console.log('--> acc_prevnext_article_cb(' + rank + ')' );
            var dfd2 = acc_default_cb(rank);

            if (dfd2) {
                //console.log('[acc_prevnext_article_cb(' + rank + ')] Waiting for dfd2 being resolved' );
                dfd2.always( function() {
                    //console.log('[acc_prevnext_article_cb(' + rank + ')]  dfd2 NOW RESOLVED' );
                    acc_cb = acc_default_cb;
                    dfd.resolve(true);
                });
            }
            else {
                dfd.resolve(true);
            }

            return dfd;

        }, /* acc_select_article_cb() */


    /**
     * JUMP-TO-POSTS ARTICLE DISPLAY Accordion tab selection callback
     *
     * /!\ ASYNC --> RETURNS A PROMISE
     *
     * 2nd argument is provided by call from accordion
     * 1st by the currying the dfd from TI.goto_eot()
     *
     */
        acc_goto_eot_cb = function(dfd, gotop, rank) {
            //console.log('--> acc_goto_eot_cb(' +  rank + ')' );
        
            // activate Plus button (must return a promise)
            // console.log('[acc_goto_eot_cb] calling fulltext');
            var dfd2          = TIJ.display_fulltext.call(null, rank);
            //console.log('[acc_goto_eot_cb] received from fulltext dfd2:' + dfd2);

            if (dfd2) {
                //console.log('[acc_goto_eot_cb] Waiting for dfd2 to resolve');
                /*
                $.when(
                    TIJ.async([*/
                //$.async(
                //    dfd2,
                //    movetopost
                //)
                //]))
                dfd2.always( function() {
                    // above the footer at bottom - 40px
                    var eot_section_bottom = $('#EOT_' + rank).offset().top - ($jqwindow.height() - 80); //40 + 40
                    //window.location = '#BOP_' + rank;
                    //console.log('[acc_goto_eot_cb] ALL DONE');
                    acc_cb = acc_default_cb;
                    if (gotop) {
                        dfd.resolve(true);
                    }
                    else {
                        var dfd3   = $.Deferred(),
                        movetoeot = function(){
                            $htmlbody //$html
                                .animate({
                                        //scrollTop: $eot_section.offset().top - $tij_header.height() - 55
                                        scrollTop: eot_section_bottom
                                    },{
                                        duration: 'slow',
                                        complete: resolve_dfd.bind(dfd3)
                                });
                            };

                        dfd3.always( resolve_dfd.bind(dfd) );
                        setTimeout(movetoeot , 50);
                    }
                });
            }
            else {
                //console.log('[acc_goto_eot_cb] dfd2 is false. Exiting (no repositionning)');
                dfd.resolve(true);
            }
            return dfd;
        }, /* acc_goto_eot_cb() */


    /***************************
     * TIJ module
     ***************************/
        tij = { 
        // transparent png image
        noimg: noimg,
        state: state,

        /**
         * START() -- >>>ENTRY POINT<<<
         *
         * Where the journey starts... ;)
         */
        start: function () {
            var tij = this;

//XXX debug();

            /**
             * DOM INITIALISATION & EXPANSION
             */
            initialize_vars_widgets();
            generate_accordion_tabs();
            generate_articles_header();
            generate_articles_summary();
            $("a.moretext").hide();
            $("a.lesstext").click( tij.collapse_menu );

            /**
             * Message Of the Day
             */
            tij.mod();

            /**
             * TOC
             *
             * . Enable "comment links" in TOC
             *   <a class="clink" id="clink_<rank>"> 3 commentaires </a>
             *   (using rank_to_tabum assocation)
             */
            $('a.clink').unbind('click').click(function(event){
                event.stopPropagation();
                tij.goto_eot.call(this);
            });


            /**
             * IMAGE VIEWER
             */
            var liveview = tij.lv = new LiveView({
                lv:      '#lv',
                lvclose: '#lvclose',
                lvcont:  '#lvcont',
                lvimg:   '#lvimg',
                lvcom:   '#lvcom'
            });

            // View summary images thru the embedded image viewer
            $('div.art_summary_img > img').each( function(){
                var id = this.id;
                $(this).click( liveview.loadviewer.bind(liveview, id, '#' + id, 0) )
            });


            /**
             * RUBRIQUE NAVIGATION BAR
             *
             * <button id="catpf" class="regional tahiti">Tahiti</button>
             *
             * Must receive the dfd from the button itself
             * in order to make the link with "external" functions
             * that need to relate on a promise to act upon
             * the click being actually completed.
             *
             * /!\ ASYNC -> returns a promise
             *
             */
            var button_to_activate = null,
                article_to_activate= null,
                rub_buttons        = state.navbar.rubbar.button,
                rub_buttons_list   = $('#tij_legendbar > button').toArray(),
                               i   = 0,
                             len   = rub_buttons_list.length;

            rub_buttons.list     = rub_buttons_list;

            for (; i<len; i++) {
                var button     = rub_buttons_list[i],
                    jqButton   = $(button),
                    bmrub      = jqButton.children('p').text(),
                    rub_button = rub_buttons[ button.id ],
                    // Associate buttons to their list of articles in the rubrique
                    jqArticles = $(
                        'h1.' +  
                        rub_button.cssclass.replace(/ /g, '.')
                    ),
                    j = 0,
                    n = jqArticles.length,
                    article,
                    rank;

                jqButton.addClass('tt');

                // Connect all infos to state vector
                rub_button.button      = button;
                rub_button.jqButton    = jqButton;
                rub_button.jqArticles  = jqArticles;
                var articles           = jqArticles.toArray();
                rub_button.articles    = articles;

                // Associate articles to their rank and navbutton category
                for(; j < n; j++) {
                    article  = articles[j];
                    //console.log('ASSOCIATE RANK TO: ' + article);
                    rank  = $(article).children('div').attr('rank');
                    article.rank  = rank;
                    state.bmrub[rank] = bmrub; // Pour marque-page default rubrique
                    state.navbutton[rank] = button; // Pour marque-page (ouvrir l'article) 
                }
                
 
                // Make the button clickable, but only if there are articles
                //      associated to the button, and then "selects" the
                //      button by enabling its background
                //
                // And ac
                if ( n > 0 ) {
                    // Make button selected and clickable
                    jqButton.addClass('on setbg').click( tij.toggle_rubrique );
                    rub_button.selected = true;
                    if ( !button_to_activate ) {
                        button_to_activate  = button;
                        article_to_activate = articles[0].rank;
                    }
                }
                else {
                    jqButton.addClass('disabled');
                }
            }

            // Set internet online/offline toggle button
            $internet.click( tij.toggle_online_offline );
            
            // Set prefetch  toggle button
            $prefetch.click( tij.toggle_prefetch );
            //
            // Set rubrique_mode button toggle
            $rubmode.click( tij.toggle_rubrique_mode );


            /** 
             * BOOKMARKS
             */
            // . Mark journal
            // . Initialize ONR/Journal localStorage
            if (hasLocalStorage) {
                // Update location
                localStorage[LS_JID_KEY + 'url'] = window.location;
                //console.log('[Bookmark] Setting ' + LS_JID_KEY + '.url: ' + localStorage[LS_JID_KEY + 'url']);

                // List of tags
                if ( ! localStorage[LS_TAGS_KEY] ) {
                    localStorage[LS_TAGS_KEY] = default_bmtag;
                }
                restore_bmtags();

                //console.log('[Bookmark] TAGS:' + localStorage[LS_TAGS_KEY]);

                // Bookmarks
                if ( ! localStorage[LS_BOOKMARKS_KEY] ) {
                    localStorage[LS_BOOKMARKS_KEY] = '';
                    //console.log('[Init Bookmark] No bookmarks in localstorage: ');
                }
                else {
                    var lskeys = localStorage[LS_BOOKMARKS_KEY].split('|');
                    var lskey,
                        i=0,
                        len=lskeys.length;
                    for(; i<len; i++) {
                        // {"<md5id>.<rank>" : onr.jti.<md5id>.<rank> (full LS key), ...}
                        lskey = lskeys[i];
                        bm_keys_hash[lskey] = lskey;

                        var $node = tij.bm_add_to_panel(lskey),
                             note = $node[0].note;

                        if (note) {
                            state.tt[ $node.attr('id') ] = note;
                            $node.hover(tt_hover, tt_hide).mousemove( tt_mouse );
                        }
                    }
                    //console.log('[Init Bookmark] Restoring bookmarks from localstorage: ' + bm_keys_hash);
                }

                // Restore bookmarked articles
                // And set click handler on articles
                var do_bookmark = function() {
                    tij.bm_open_panel();
                    tij.bookmark(this);
                }
                $('.bookmk').each( function(){
                    var div   = this,
                        jq    = $(div),
                        rank  = jq.attr('rank');
                        lskey = LS_JID_KEY + rank;

                    div.rank       = rank;
                    div.lskey      = lskey;
                    div.dmy        = jq.attr('dmy'); // date de l'article
                    div.bookmarked = false;

                    bm_local_keys[lskey] = div;

                    if ( localStorage[lskey] ) {
                        //console.log('[Bookmark] Restoring bookmark#' + rank);
                        jq.removeClass('off').addClass('on');
                        this.bookmarked = true;
                    }

                    jq.click( do_bookmark );
                });

                // Stop eventPropagation on bm_tag bm_note input fields
                var stop_event_propagation = function(e){
                    e.stopPropagation();
                }

                $bm_tag.bind('input', stop_event_propagation);
                $bm_note.bind('input', stop_event_propagation);
            }

            $bm_open.click(tij.bm_open_panel);
            $bm_close.click(tij.bm_close_panel);


            /**
             * SEARCH PANEL
             *
             * Enable open/close buttons
             *
             */
            $sh_open.click( tij.open_search_options_panel );
            $sh_close.click( tij.close_search_options_panel );


            /**
             * SIMPLE TOOLTIP
             *
             * Version 2 :
             *    . shows after a certain delay while the mouse is iddle
             *    . disappears once the mouse moves again
             *    . Does not show up while same zone
             *
             */
            $tooltip.animate({opacity: 0},{duration: 1});
            tt_pos = $tooltip.offset();
            $('.tt').hover(tt_hover, tt_hide).mousemove( tt_mouse );

            /**
             * SIMPLE TOOLTIP
             *
             * Version 1 :
             *    . stick to mouse
             *    . hidden after a certain duration
             *    . duration increases if coming back into same zone 
             *
            $tooltip.animate({opacity: 0},{duration: 1});
            var tt_pos    = $tooltip.offset(),
                tt_id     = '', // Zone triggering the tooltip
                tt_oid    = '', 
                tt_lastid = '', 
                tt_timer  = '',
                tt_active = false,
                tt_X,
                tt_Y,
                tt_duration_orig = 2000,
                tt_duration = tt_duration_orig;

            var stick_to_mouse = function(event) {
                    if (tt_active) {
                        tt_X        = event.pageX + 12;
                        tt_Y        = event.pageY + 13;
                        tt_pos.top  = tt_Y;
                        tt_pos.left = tt_X;
                        $tooltip.offset(tt_pos);
                    }
                },

                // HIDE_TT
                hide_tt= function(inzone) {
                    tt_active = false;
                    //console.log('[TT OUT] inzone:' + inzone + ' id:' + tt_id + ' oid:' + tt_oid);
                    if ( tt_timer ) {
                        // tooltip did not stay in the same zone long enough 
                        // to be started. We just cancel the timer
                        clearTimeout( tt_timer );
                    }
                    if ( $tooltip.is(':visible') ) {
                        $tooltip.animate({opacity: 0},{duration: 'fast'});
                    }
                    tt_oid = inzone ? tt_id : '';
                    tt_timer = ''; // cancel the timer
                },
                
                // Display the tooltip after 400ms if has stayed in the same
                // zone.
                // Trigger to remove the tooltip after a certain period
                // being displayed
                display_tt= function() {
                    tt_timer = ''; // cancel the timer
                    if ( tt_oid == '' ) {
                        tt_oid      = tt_id;
                        tt_pos.top  = tt_Y;
                        tt_pos.left = tt_X;
                        $tooltip.offset(tt_pos).animate({opacity: 0.91},{duration: 'fast'});

                        // Are we requested to longer view of the same tooltip ?
                        if (tt_lastid == tt_id) {
                            tt_duration *= 1.5;
                        }
                        else {
                            tt_lastid   = tt_id;
                            tt_duration = tt_duration_orig;
                        }
                        //console.log('[TT IN] id:' + tt_id + ' oid:' + tt_oid + ' tt_last:' + tt_lastid + ' duration:' + tt_duration);
                        tt_timer = setTimeout( hide_tt.bind(null,1), tt_duration);
                    }
                };

            $('.tt').hover(
                // IN
                function(event) {
                    tt_id     = this.id;
                    tt_active = true;
                    
                    // Get the initial position ready too!
                    tt_X     = event.pageX + 12;
                    tt_Y     = event.pageY + 13;
                    
                    // Get the tooltip ready
                    $tooltip.html( state.tt[ tt_id ] );
                    
                    // Set the timer...
                    tt_timer = setTimeout( display_tt, 400);
                },
                hide_tt.bind(null,0)
            ).mousemove( stick_to_mouse );

            // END TOOLTIP VERSION 1
            */


            /**
             * START TOC ACCORDION
             */
            $tij_journal_accordion.accordion(
                {   collapsible: true, 
                    active:      false,
                    heightStyle: "content",
                    icons: { 
                        header:       "ui-icon-circle-arrow-e",
                        activeHeader: "ui-icon-circle-arrow-s"
                    },
                    animate: {
                        // easing:   animate: 'slide', slide, easeInQuad, easeInCubic, easeInQuart, easeInQuint, easeInSine, easeInExpo, easeInCirc, easeInElastic, easeInBack, easeInBounce
                        duration: 'fast'
                    },

                    activate: function(event, ui) {
                        //console.log('[ACCORDION] --> activate()');
                        // newPanel is a non empty object on activation 
                        // Launch article header's image lazy loading...
                        // The first time only !
                        if ( ! jQuery.isEmptyObject(ui.newPanel) ) {
                            var rank = ui.newPanel.attr('rank');
                            //console.log('[ACCORDION activate] rank:' + rank);
                            if ( rank !== undefined ) {
                                var dfd = acc_cb( rank );
                                //console.log('[ACCORDION activate] rank:' + rank + ' DFD--> ' + dfd );
                                if (dfd) {
                                    $.when(dfd)
                                        .always( function(isok) {
                                            //console.log('[ACCORDION] rank:' + rank + ' RESOLVED(' + isok + ')' );
                                            if (isok) {
                                                //console.log('[ACCORDION] marking article:' + rank);
                                                tij.mark_article(ui.newHeader[0]); // <h1...>...</h1>
                                            }
                                        });
                                }
                                return dfd;
                            }
                        }
                        // Call the callback only to resolve the associated dfd
                        acc_cb( undefined );
                    }
                }
            ); /* accordion */


            /**
             * KBD EVENTS
             */
            /* V1
            $sh_lookup.bind('keypress', function(e) {
                if ( e.keyCode == 13 ) {
                    $sh_go.trigger('click');
                }
            });

            $(window)
                .keydown( function(event) { // <Ctrl> down
                    var odyssey_viewer = TIJ.lv;
                    //console.log('event.keyCode --> ' + event.keyCode);
                    //select_prevnext_rubrique: function(delta) { //next(+1) prev(-1)

                    switch( event.keyCode ) {
                        case 27: // ESCAPE //
                            if ( odyssey_viewer.lv.is(':visible') ) {
                                odyssey_viewer.exit();
                            }
                            else {
                                tij.collapse_menu();
                            }
                            break;
                        case 39: //console.log('Next rubrique');
                            TIJ.select_prevnext_rubrique(1);
                            break;
                        case 37: //console.log('Prev rubrique');
                            TIJ.select_prevnext_rubrique(-1);
                            break;
                        case 40: //console.log('Next article');
                            odyssey_viewer.exit();
                            TIJ.select_article(1, 1);
                            break;
                        case 38: //console.log('Previous article');
                            odyssey_viewer.exit();
                            TIJ.select_article(1, -1);
                            break;
                        case 36: //console.log('First article');
                            odyssey_viewer.exit();
                            TIJ.select_article(0, 0);
                            break;
                        case 35: //console.log('Last article');
                            odyssey_viewer.exit();
                            TIJ.select_article(0, 1);
                            break;
                        case 13: //ENTER// Display full article of selected article
                        case 32: //SPACE// Display full article of selected article
                            odyssey_viewer.exit();
                            var sdc    = state.display.current,
                                artidx = sdc.artidx;
                            if ( artidx >= 0 ) {
                                TIJ.display_fulltext(sdc.article.rank);
                            }
                            break;
                        case 80: //P(osts)//    GoTo POSTS ZONE
                        case 67: //C(omments)// Open Odyssey Image Viewer
                            odyssey_viewer.exit();
                            var sdc    = state.display.current,
                                artidx = sdc.artidx;
                            if ( artidx >= 0 ) {
                                //console.log('GOTO -> ' + sdc.article.rank);
                                TIJ.goto_posts(sdc.article.rank);
                            }
                            break;
                        case 73: //I(mage)//    Open Odyssey Image Viewer
                            var sd     = state.display,
                                sdc    = sd.current,
                                artidx = sdc.artidx;
                            if ( artidx >= 0 ) {
                                var rank = sdc.article.rank,
                                    sdft = sd.fulltext[rank],
                                    sdst = sd.summary[rank],
                                    oiv  = TIJ.lv;
                                if ( sdft && sdft.loaded ) {
                                    // Fulltext images loaded
                                    oiv.loadviewer(rank, 'img.img_set_' + rank, 0);
                                } 
                                else {
                                    //console.log('SDST -> ' + sdst);
                                    //console.log('SDST.loaded -> ' + sdst.loaded);
                                    if ( sdst && sdst.loaded ) {
                                        // Summary image loaded
                                        var id = "art_summary_img_img_" + rank;
                                        oiv.loadviewer(id, '#'+id, 0);
                                    } 
                                }
                            }
                            break;
                    }
                });
            */

            var foo = function(a) {
                    liveview.exit();
                    tij.select_article(0, a);
                },
                foo1 = foo.bind(null,0),
                foo2 = foo.bind(null,1),
                foo3 = function(a,b) {
                    liveview.exit();
                    var sdc    = state.display.current,
                        artidx = sdc.artidx;
                    if ( artidx >= 0 ) {
                        tij.select_article(a, b);
                    }
                    else tij.select_article(0, 0);
                },
                foo4 = function(gotop) {
                    liveview.exit();
                    var sdc    = state.display.current,
                        artidx = sdc.artidx;
                    if ( artidx >= 0 ) {
                        //console.log('GOTO -> ' + sdc.article.rank);
                        tij.goto_eot(sdc.article.rank,gotop);
                    }
                };

            // Press on search input zone triggers search
            $sh_lookup.kbdRegister('ENTER', function(){ 
                //$sh_go.trigger('click');
                $sh_go.click();
            });
            
            // Press on bookmark tag input field
            $bm_overlay.kbdRegister(['ENTER','ESC'], bm_overlay_close );

            // Escape
            $.kbdRegister(['ESC', '-', 'TIRET', 'M'], 
                function() {
                    if (! liveview.exit() ) {
                        tij.collapse_menu();
                        tij.bm_close_panel();
                    }
                }
            );

            // <LEFT>:: Previous rubrique
            $articles_zone.kbdRegister('LEFT',  tij.select_prevnext_rubrique.bind(null,-1) );

            // <RIGHT>: Next rubrique
            $articles_zone.kbdRegister('RIGHT', tij.select_prevnext_rubrique.bind(null,+1) );

            // <Home|Orig> | <Ctrl><UP> :: Open 1st article
            $articles_zone.kbdRegister('HOME', foo1);
            $articles_zone.kbdRegister('UP',   foo1, {'CTRL': true});
            
            // <End|Fin> | <Ctrl><DOWN> :: Open last article
            $articles_zone.kbdRegister('END',  foo2);
            $articles_zone.kbdRegister('DOWN', foo2, {'CTRL': true});
            
            // <Shift><UP> :: Open previous article
            $articles_zone.kbdRegister('UP',   foo3.bind(null,1,-1), {'SHIFT': true});
            
            // <Shift><DOWN> :: Open next article
            $articles_zone.kbdRegister('DOWN', foo3.bind(null,1,1),  {'SHIFT': true});

            // D,B,+  :: Open article fulltext et se place au début de l'article
            $articles_zone.kbdRegister(['D', 'P', '+'], foo4.bind(null,true));
            $articles_zone.kbdRegister('=', foo4.bind(null,true), {'SHIFT': true}); //+

            // <P|C>  :: Se palce à la fin de l'article (commentaires)
            $articles_zone.kbdRegister(['F', 'C'], foo4.bind(null,false));

            // <I> :: Open Image viewer
            $articles_zone.kbdRegister('I', function(){
                            var sd     = state.display,
                                sdc    = sd.current,
                                artidx = sdc.artidx;
                            if ( artidx >= 0 ) {
                                var rank = sdc.article.rank,
                                    sdft = sd.fulltext[rank],
                                    sdst = sd.summary[rank];
                                if ( sdft && sdft.loaded ) {
                                    // Fulltext images loaded
                                    liveview.loadviewer(rank, 'img.img_set_' + rank, 0);
                                } 
                                else {
                                    //console.log('SDST -> ' + sdst);
                                    //console.log('SDST.loaded -> ' + sdst.loaded);
                                    if ( sdst && sdst.loaded ) {
                                        // Summary image loaded
                                        var id = "art_summary_img_img_" + rank;
                                        liveview.loadviewer(id, '#'+id, 0);
                                    } 
                                }
                            }
            });


            /**
             *  OPEN 1ST NON-EMPTY NAVBAR RUBRIQUE
             *  OPEN ITS 1ST ARTICLE
             *
             *  'button_to_activate.id' provides the name of the rubrique (catpf, ...)
             *
             */
            if ( button_to_activate ) {
                var dfd = tij.toggle_rubrique.call(button_to_activate, 0);
                if (dfd) {
                    $.when( dfd )
                        .always(function(){
                            //current_display.rubidx = -1;
                            tij.mark_rubrique(button_to_activate);
                            //setTimeout(TIJ.activate_menu.bind(null,article_to_activate), 2000);
                            $('#tabnum_' + rank_to_tabnum[rank]).focus();
                        });
                }
            }


            /**
             * PREFETCH IMAGES
             */
            $.when( estimate_bandwidth(3) ).always( function(bw) {
                if ( bw == 0 ) {
                    $internet_bw.text('Aucune');
                    prefetch_cache_size = 1; // pour l'activation manuelle
                }
                else {
                    $internet_bw.text(bw + ' Kbps');

                    var nx256 = Math.floor(bw / 256);
                    prefetch_cache_size = nx256 < 2 ? 1
                        : nx256 < 4  ? 2 
                        : nx256 < 8  ? 3 
                        : nx256 < 12 ? 4 
                        : nx256 < 17 ? 5 
                        : nx256 < 22 ? 6 
                        : nx256 < 27 ? 7 
                        : 8;

                    // online
                    tij.toggle_online_offline();

                    if ( nx256 > 2 ) {
                        // Turn prefetch modes on
                        tij.toggle_prefetch();
                    }
                }
            });
            pre_prefetch_images();

        }, /* start() */


        /**
         * activate_menu(0..)
         *
         * activate an accordion'menu (counted from 0)
         */
        activate_menu:  function(rank) { // rank from 0
            //console.log('--> activate_menu tabnum:' + tabnum);
            var tabnum = rank_to_tabnum[ rank ];
            return $tij_journal_accordion.accordion('option', 'active', tabnum);
        },


        /**
         * collapse_menu()
         */
        collapse_menu:  function() {
            return $tij_journal_accordion.accordion('option', 'active', false);
        },


        /**
         * Mark/Unmark Selected Rubrique
         */
        mark_rubrique: function( rub_button ) {
            state.display.current.rubidx = jQuery.inArray( rub_button.id, state.navbar.rubbar.button.rublist );
        },

        unmark_rubrique: function( ) {
            state.display.current.rubidx = -1;
            TIJ.unmark_article();
        },


        /**
         * Select previous / next rubrique
         *
         * ASYNC
         *
         * Returns ::
         *  - False: action cannot be carried over
         *  - dfd  : base on dfd to chain actions
         */
        select_prevnext_rubrique: function(delta) { //next(+1) prev(-1)
            var rubidx      = state.display.current.rubidx,
                rubbar      = state.navbar.rubbar,
                rub_buttons = rubbar.button,
                rublist     = rub_buttons.rublist,
                n           = rublist.length,
                rub_button;

            if ( rubbar.mode.selected == 'exclusif' ) {
                if (delta < 0) {
                    delta += n;
                }

                while(true) {
                    rubidx = (rubidx + delta) % n;
                    //console.log('rubidx: ' + rubidx);
                    rub_button = rub_buttons[ rublist[rubidx] ];
                    if ( rub_button.articles.length > 0 ) {
                        return TIJ.toggle_rubrique.call( rub_button.button );
                    }
                }
                return false;
            }
            TIJ.console('Touche fonction disponible en mode <b>Mono-Rubrique</b> uniquement!');
            return false;
        },


        /**
         * Mark/Unmark Selected Article
         */
        mark_article: function( article ) { // <h1...>...<.h1>  accordion header
            var current_display = state.display.current;

            if ( article.index !== undefined ) {
                current_display.artidx  = article.index;
            }
            else {
                var rub_buttons = state.navbar.rubbar.button,
                rubrique        = rub_buttons.rublist[current_display.rubidx];

                if (rubrique) {
                    current_display.artidx = jQuery.inArray(
                        article, 
                        rub_buttons[ rubrique ].articles
                    )
                }
            }
            current_display.article  = article;
            //console.log('[Mark article] new index:' + current_display.artidx);
        },

        unmark_article: function( ) {
            state.display.current.artidx = -1;
        },


        /**
         * Select previous / next article / first / last article of the
         * current rubrique (if defined)
         *
         * ASYNC
         *
         * Returns ::
         *  - False: action cannot be carried over
         *  - dfd  : base on dfd to chain actions
         *
         *  mode / value
         *  1      +1    :: next     article    
         *  1      -1    :: previous article
         *  0       0    :: first    article
         *  0       1    :: last     article
         */
        select_article: function(mode, value) { //next(+1) prev(-1)
            var current_display = state.display.current,
                current_artidx  = current_display.artidx,
                rubbar          = state.navbar.rubbar,
                rub_buttons     = rubbar.button,
                rubrique        = rub_buttons.rublist[current_display.rubidx];

            if ( rubrique === undefined ) {
                // No rubrique selected
                return false;
            }

            if ( rubbar.mode.selected == 'exclusif' ) {
                var dfd             = $.Deferred(),
                    articles        = rub_buttons[ rubrique ].articles,
                    artidx          = mode ? current_artidx + value : (articles.length - 1) * value;
                //console.log('[Select article] current:' + current_artidx + ' mode:' + mode + ' value:' + value + ' ==> ' + artidx);

                if ( artidx >= 0 && artidx < articles.length && artidx != current_artidx ) {
                    // Associate the index to the article, so to mark the article
                    // once selected by the accordion
                    var article   = articles[ artidx ],
                        rank      = article.rank,
                        $acctab   = $('#tabnum_' + rank);

                    article.index = artidx; 
                    //console.log('[SELECT ARTICLE] index:' + artidx);

                    // handler to pass the dfd thru the accordion 
                    acc_cb = acc_select_article_cb.bind(null, dfd);

                    // manually activate accordion tab
                    TIJ.activate_menu( rank );
                    $.when(dfd).always(function(){ 
                        //console.log('Giving focus to #tabnum_' + rank);
                        $acctab.focus();
                    });
                    return dfd;
                }
                return false;
            }
            TIJ.console('Touche fonction disponible en mode <b>Mono-Rubrique</b> uniquement!');
            return false;
        },


        /**
         * toggle_rubrique_aux()
         *
         *  Hide/Show articles of a given category
         *
         * 'this' is the DOM Div that simulates a button
         *
         * /!\ ASYNC --> RETURNS A PROMISE
         *
         */
        toggle_rubrique_aux: function(duration) {
            var button      = this,
                rubbar      = state.navbar.rubbar,
                rub_button  = rubbar.button[ button.id ],
                jqButton    = rub_button.jqButton,
                jqArticles  = rub_button.jqArticles,
                nb_articles = jqArticles.length,
                nb_toggled  = 0,
                dfd         = $.Deferred(),
                mode;

            if ( duration === undefined ) {
                duration = rubbar.toggle_duration;
            }

            var done = function() {
                nb_toggled++;

                if (nb_toggled == nb_articles) {
                    //TIJ.setbg_rubrique_mode_button();
                    if (mode) {
                        TIJ.mark_rubrique(button);
                        rub_button.selected = true;
                        // Give focus to the 1st tab
                        //console.log('[toggle_rubrique_aux] Giving focus to #tabnum_' + rub_button.articles[0].rank);
                        $('#tabnum_' + rub_button.articles[0].rank).focus();
                    }
                    else {
                        TIJ.unmark_rubrique();
                        rub_button.selected = false;
                    }
                    dfd.resolve(true);
                }
            },
                animation = duration > 0
                    ? {
                        duration: duration,
                        complete: done
                    }
                    : { duration: 0, complete: done } ;

            // Accordion keeps state about content, so not to worry
            // about content sub-visibilities as long as accordion
            // is all collapsed.
            // Therefore manually collapse accordion first!
            TIJ.collapse_menu();

            if ( rub_button.selected ) {
                jqButton.removeClass('on setbg').addClass('off setfg');
                //console.log('HIDING id:' + button.id + " Class:" + jqButton.attr('class') + " nbarticle: -" + nb_articles);
                mode = 0;
                $nbdisp.text( parseInt( $nbdisp.text() ) - nb_articles);
                jqArticles.fadeOut( animation );
            }
            else {
                jqButton.removeClass('off setfg').addClass('on setbg');
                //console.log('SHOWING id:' + button.id + " Class:" + jqButton.attr('class') + " nbarticles: +" + nb_articles);
                mode = 1;
                $nbdisp.text( parseInt( $nbdisp.text() ) + nb_articles);
                jqArticles.fadeIn( animation );
            }

            /* ASYNC */
            return dfd;
        },


        /**
         * toggle_rubrique(duration) (this = rubrique button DOM elt)
         *
         *  Hide/Show articles of categories based on rubrique mode (additif
         *  or exclusif
         *
         * /!\ ASYNC --> RETURNS FALSE or A PROMISE
         *
         */
        toggle_rubrique: function(duration) {
            //alert(' [Toggle Rubrique] Selected Rubrique:' + this.id );
            var master_button = this,
                rubbar        = state.navbar.rubbar,
                dfd           = GUI_TOKEN_get();

            if (!dfd) {
                // Token not available. Action cannot be performed
                return false;
            }

            var resolve = resolve_dfd.bind(dfd);

            // ADDITIVE MODE
            if ( rubbar.mode.selected == 'additif' ) {
                $.when( TIJ.toggle_rubrique_aux.call(master_button, duration) )
                    .always( resolve );
            }

            // EXCLUSIVE MODE
            else {

                // 1) Deselect all already selected categories excepting master,
                //    a condition that can happen when the mode was just toggled
                var     rub_buttons = rubbar.button,
                    rub_button_list = rub_buttons.list,
                          async_seq = [],
                                  i = 0,
                                len = rub_button_list.length;

                for (; i<len; i++){
                    var button = rub_button_list[i];
                    if ( button.id != master_button.id && rub_buttons[button.id].selected ) {
                        //console.log('[Toggle navmode] Closing rubrique:' + button.id);
                        async_seq.push( TIJ.toggle_rubrique_aux.bind(button,duration) );
                    }
                }

                // 2) Select the category (if currently deselected)
                if ( async_seq.length == 0 ) {
                    /* Condition:: master_on or (master_off and all other off)
                     * -> simply toggle the button
                     */
                    $.when( TIJ.toggle_rubrique_aux.call(master_button, duration) )
                        .always( resolve );
                }
                else {
                    if ( ! rub_buttons[master_button.id].selected ) {
                        /* Condition:: master_off and other_on
                         * -> close all on and open master
                         */
                        async_seq.push( TIJ.toggle_rubrique_aux.bind(master_button,duration) );
                    }
                    /* 
                     * else case: master_on other_on
                     * -> only close others to respect exclusive mode
                     *  semantics
                     */
                }

                // Launch the work !
                //$.when( TIJ.async( async_seq ) ).always( resolve );
                $.async(async_seq).always( resolve );
            }

            /* ASYNC */
            return dfd;
        },


        /**
         * toggle_rubrique_mode()
         *
         * 'this' is the DOM Div that simulates a button
         *
         */
        toggle_rubrique_mode: function() {
            var nav_mode_button      = state.navbar.rubbar.mode;
            nav_mode_button.selected = nav_mode_button[ nav_mode_button.selected ].toggle;
            state.tt.rubmode         = state.tt.states.rubmode[ nav_mode_button.selected ];
            TIJ.console( TIJ.conmsg.rubmode[nav_mode_button.selected] );
            // update bg 
            TIJ.setbg_rubrique_mode_button();
        },


        /**
         * rubrique_mode_set_exclusif()
         *
         */
        rubrique_mode_set_exclusif: function() {
            if ( state.navbar.rubbar.mode.selected !== 'exclusif') {
                TIJ.toggle_rubrique_mode();
            }
        },


        /**
         * toggle_online_offline()
         *
         */
        toggle_online_offline: function() {
            var navbar   = state.navbar;
            if ( navbar.internet ) {
                navbar.internet = false;
                $internet.removeClass('online').addClass('offline');
                state.tt.internet = state.tt.states.internet.offline;
                TIJ.console( TIJ.conmsg.internet.offline );
            }
            else {
                navbar.internet = true;
                $internet.removeClass('offline').addClass('online');
                state.tt.internet = state.tt.states.internet.online;
                TIJ.console( TIJ.conmsg.internet.online );
                // Enable facebook social pluggin
                //load_fbjssdk();
            }
        },


        /**
         * toggle_prefetch()
         *
         * /!\ ASYNC
         */
        toggle_prefetch: function() {
            var navbar   = state.navbar;
            if ( navbar.prefetch ) {
                navbar.prefetch = false;
                $prefetch.removeClass('on').addClass('off');
                state.tt.prefetch = state.tt.states.prefetch.off;
                TIJ.console( TIJ.conmsg.prefetch.off );
            }
            else {
                navbar.prefetch = true;
                $prefetch.removeClass('off').addClass('on');
                state.tt.prefetch = state.tt.states.prefetch.on;
                TIJ.console( TIJ.conmsg.prefetch.on );
                // Resume prefetching
                $.when( prefetch_images() ).always( function() {
                    TIJ.console( TIJ.conmsg.prefetch.over );
                });
                // Enable facebook social pluggin
                //load_fbjssdk();
            }
        },


        /**
         * set_bg_rubrique_mode_button()
         *
         *  Hide/Show articles of a given category
         *
         * 'this' is the DOM Div that simulates a button
         *
         */
        setbg_rubrique_mode_button: function() {
            /* V1, with colored background 
            var selected = TIJ.rubbar_buttons_selected();
            $('#rubmode')
                .removeClass()
                .addClass(
                    state.navbar.rubbar.mode[ state.navbar.rubbar.mode.selected ].cssclass + 
                    ' '   + 
                    (  selected.length > 1 ? 'white'
                      : selected.length > 0 ? state.navbar.rubbar.button[ selected[0] ].cssclass
                      : 'grey'
                    )
                );
            */
            // V2, fixed color background
            var nav_mode_button = state.navbar.rubbar.mode;
            $rubmode
                .removeClass()
                .addClass(
                    nav_mode_button[ nav_mode_button.selected ].cssclass
                );
        },


        /**
         * currently_selected = rubbar_buttons_selected()
        rubbar_buttons_selected: function() {
            var rub_buttons = state.navbar.rubbar.button;
            return rub_buttons.rublist.filter( function(rubrique) {
                return rub_buttons[rubrique].selected;
            });
        },
         */

        /**
         * ================================
         *  SEARCH ENGINE
         * ================================
         */
        /**
         * open_search_options_panel()
         *
         * Where the journey starts... ;)
         */
        open_search_options_panel: function() {
            var dfd = $.Deferred();
            /*
            $.when(
                TIJ.async([ */
            $.async(
                    shfactory($sh_open,  m_fadeOut),
                    shfactory($sh_bot,   m_slideDown),
                    shfactory($sh_close, m_fadeIn)
            )
            // ]))
            .always( resolve_dfd.bind(dfd) );
            return dfd;
        },


        /**
         * close_search_options_panel()
         *
         * Where the journey starts... ;)
         */
        close_search_options_panel: function() {
            var dfd  = $.Deferred();
            /*
            $.when(
                TIJ.async([*/
            $.async(
                    shfactory($sh_close, m_fadeOut),
                    shfactory($sh_bot,   m_slideUp),
                    shfactory($sh_open,  m_fadeIn)
            )
            //]))
            .always( resolve_dfd.bind(dfd) );
            return dfd;
        },


        /**
         * search()
         *
         * Where the journey starts... ;)
         */
        search: function() {
            var lookup = $.trim( $sh_lookup.val() ),
                searchResults_rubbutton = state.navbar.rubbar.button.catsearch,
                button                  = searchResults_rubbutton.button;

            // No search pattern was provided
            if (! lookup) return;

            // Deselect result rubrique
            if (searchResults_rubbutton.selected) {
                //console.log('[SEARCH] Results tab selected. Deselect it!');
                var dfd = TIJ.toggle_rubrique.call( button );
                if (dfd) {
                    $.when( dfd )
                        .always( TIJ.search_aux_1.bind(null,lookup, searchResults_rubbutton.jqButton) );
                }
                else {
                    // On n'a pas la main pour refermer la rubriqued des résultats...
                    // User must relaunch its search
                    TIJ.console('Merci de relancer votre recherche !');
                    return false;
                }
            }
            else {
                //console.log('[SEARCH] Results tab NOT selected!');
                TIJ.search_aux_1(lookup, searchResults_rubbutton.jqButton);
            }
        },

        search_aux_1: function(lookup, jqButton) {
            // Disable Result Tab and put the search widget in searching mode
            //console.log('[SEARCH] --> search_aux_1()');

            $.when( TIJ.close_search_options_panel() )
                .always( function() {
                    jqButton.removeClass().addClass('disabled').unbind('click');
                    $sh_go.addClass('searching');
                    TIJ.search_aux_2(lookup);
                });
        },

        search_aux_2: function(lookup) {
            var rub_buttons             = state.navbar.rubbar.button,
                searchResults_rubbutton = rub_buttons.catsearch,
                button                  = searchResults_rubbutton.button,
                jqButton                = searchResults_rubbutton.jqButton;

            // 0. Restablish original text
            sh_nodes.forEach( function(node) {
                if ( node.html ) {
                    node.jqnode.html( node.orig );
                }
                else {
                    node.jqnode.text( node.orig );
                }
            });
            sh_nodes = [];

            // 1. Collect search options
            sh_options       = {}; // LIste les rubriques sélectionnées pour la recherche
            var sh_opts_list = $sh_opts.find('input:checked').toArray(),
                           i = 0,
                         len = sh_opts_list.length,
                           j, lenj;

            for (; i<len; i++){
                sh_options[ sh_opts_list[i].value ] = true;
            }

            // 2. Prepare search regex
            // 
            // Soit <lookup> =  (w1 w2... wn)
            // 
            // . regex             => (regex) => $1
            //
            // . not(whole)        => w1' w2' .... wn' | wi' = wi
            // . whole             => w1' w2' .... wn' | wi' = "\bwi\b"
            // . contigus          => w1' \s* w2' ...
            // . phrase            => w1' [^,:;.!?]*? w2' ...
            // . texte             => w1' .*? w2' ...
            // . part              => w1' |   w2' ...
            //
            var icase         = sh_options['casse'] ? 'g' : 'gi',
                regexp;

            if ( sh_options['regex'] ) {
                regexp = new RegExp(lookup, icase);
            }
            else {
                var lookup_list = lookup.split(/\s+/).map( function(w) {
                    return TIJ.escape_regexp(w);
                });

                if ( sh_options['whole'] ) {
                    lookup_list = lookup_list.map( function(w) {
                        return '\\b' + w + '\\b';
                    });
                }

                // For exact colorization
                sh_regexp  = new RegExp( lookup_list.join('|'), icase );

                var sep = sh_options[ 'contigus' ] ? '\\s*'
                        : sh_options[ 'phrase'   ] ? '[^,;:.!?]*?'
                        : sh_options[ 'texte'    ] ? '.*?'
                        : sh_options[ 'part'     ] ? '|'
                        :                            '[^,;:.!?]*?';
                regexp  = new RegExp( lookup_list.join(sep), icase );
            }

            //console.log('[Search] Regexp: ' + regexp.toString());

            // 3. Select articles from wanted rubriques
            var textnodes_selector_pattern = 
                  sh_options['onlyposts'] ? '#art_posts_{0} div.post_pseudo'
                : sh_options['wide'     ] ? '#art_body_title_{0}, #art_body_author_{0}, #art_posts_{0} div.post_pseudo'
                :                           '#art_body_title_{0}, #art_body_author_{0}',

                htmlnodes_selector_pattern = 
                  sh_options['onlyposts'] ?  '#art_posts_{0} div.post_text'
                : sh_options['wide'     ] ?  '#art_summary_txt_{0}, #art_body_{0} div.art_body_section_text, #art_posts_{0} div.post_text'
                :                            '#art_summary_txt_{0}, #art_body_{0} div.art_body_section_text',

            // 4. Search articles
                rubriques = $sh_cats.find('input:checked').toArray(),

            //console.log('[Search] Nombre de rubriques: ' + rubriques.length);
                selection = [],
                    rub_i = 0,
                  rub_len = rubriques.length,
                  rubrique,
                  articles,
                  article,
                  rank,
                  textnodes_list,
                  htmlnodes_list,
                  found,
                  str_rep;

            for(; rub_i < rub_len; rub_i++) {
                rubrique = rubriques[rub_i].value;

                // Expan posts (they may or not already be expanded)
                generate_body_posts_rubrique(rubrique); 

                articles = rub_buttons[ rubrique ].articles;
                //console.log('[Search] Recherche sur les articles de la rubrique:'  + rubriques[rub_i].value + " => " + articles.length + ' articles');

                // Scan all the articles of the given rubrique
                for(i = 0, len = articles.length; i < len; i++) {
                    article  = articles[i];
                    rank     = article.rank;

                    //console.log("###### ARTICLE ##### " + rank);

                    textnodes_list = $( TIJ.ssprintf(textnodes_selector_pattern, article.rank) ).toArray();
                    htmlnodes_list = $( TIJ.ssprintf(htmlnodes_selector_pattern, article.rank) ).toArray();

                    // 1. TEXT NODES
                    // console.log('[Search] TEXT nodes:' + textnodes_list.length);
                    found = 0;
                    sh_n  = 0;
                    for(j=0, lenj = textnodes_list.length; j < lenj; j++) {
                        var $node    = $(textnodes_list[ j ]),
                            str_orig = $node.text();
                        //console.log('[Search] TEXT ORIG:' + str_orig);

                        str_rep  = str_orig.replace(regexp, sh_foo);
                        //console.log('[Search] TEXT REPLACED:' + str_rep);

                        if ( sh_n > 0 ) {
                            $node.html( str_rep );
                            sh_nodes.push({
                                jqnode: $node,
                                orig:   str_orig,
                                html:   0   // text
                            });
                            found++;
                        }
                    }
                    
                    // 2. HTML NODES
                    // console.log('[Search] HTML nodes:' + htmlnodes_list.length);
                    sh_n = 0;
                    for(j=0, lenj = htmlnodes_list.length; j < lenj; j++) {
                        var $node    = $(htmlnodes_list[ j ]),
                            str_orig = $node.html();
                        //console.log('[Search] HTML ORIG:' + str_orig);

                        str_rep  = str_orig.replace(regexp, sh_foo);
                        //console.log('[Search] HTML REPLACED:' + str_rep);

                        if ( sh_n > 0 ) {
                            $node.html( str_rep );
                            sh_nodes.push({
                                jqnode: $node,
                                orig:   str_orig,
                                html:   1   // html
                            });
                            found++;
                        }
                    }

                    if (found > 0) selection.push(article);
                }
            }
            
            // 5. Display results
            //alert('Displaying results => ' + selection.length );
            $sh_go.removeClass('searching'); // Put the search bar into input mode

            searchResults_rubbutton.articles   = selection;
            searchResults_rubbutton.jqArticles = $( selection );

            if ( selection.length > 0) {
                TIJ.console( selection.length + ' article' + (selection.length > 1 ? 's correspondent ' : ' correspond ') + 'au motif et options de la recherche.' );
                jqButton.removeClass().addClass( searchResults_rubbutton.cssclass ).addClass('off setfg').click( TIJ.toggle_rubrique );
                searchResults_rubbutton.selected = false;

                //switch into exclusif mode
                TIJ.rubrique_mode_set_exclusif();

                // Select the Results Tab
                TIJ.toggle_rubrique.call( button );
            }
            else TIJ.console("Aucun article ne correspond au motif et options de la recherche.<br/>Essayez de modifier les options afin d'elargir le champ de recherche (bouton '+' sous la zone de saisie).");

            return false;
        },


        /**
         * goto_eot(rank)
         *
         * Open the accordion'menu if closed, and goto End of Article
         *
         * /!\ ASYNC --> RETURNS A PROMISE
         *
         */
        goto_eot: function(rank, gotop /*V1,V2 only tabnum, rank*/) { // rank from 0
            var dfd = $.Deferred();

            // V3 only
            rank = rank || ( this.id.split('_') )[1];
            //var tabnum = rank_to_tabnum[rank];
            //console.log('[GOTO POSTS] RANK:' + rank); // + ' TABNUM:' + tabnum);
            var sdc        = state.display.current,
                artidx     = sdc.artidx,
                $container = $("#art_container_" + rank);

            if ( artidx >= 0 && sdc.article.rank == rank && $container.is(":visible") ) {
                //console.log('[GOTO POSTS] RANK:' + rank + ' Direct CB');
                // article is currently visible. Goto posts !
                acc_goto_eot_cb(dfd, gotop, rank);
            }
            else {
                //console.log('[GOTO POSTS] RANK:' + rank + ' INDirect CB');
                // Setting ponctual accordion activation handler with curryied dfd
                acc_cb = acc_goto_eot_cb.bind(null, dfd, gotop);
            
                // manually activate accordion tab
                TIJ.activate_menu(rank);
            }

            return dfd;
        },


        /**
         * <lazy_context>.img_err_h60()
         *
         * Hide the image zone
         *
         * /!\ ASYNC --> RETURNS A PROMISE
         *
         */
        img_err_h60: function() {
            //alert('(60) NO IMAGE: ' + this.dom.src);
            var img  = this,
                rank = img.context.rank,
                dfd  = $.Deferred();

            $('#art_summary_img_' + rank).hide({
                duration: 'fast',
                complete: function(){ 
                    state.display.summary[rank].done = true;
                    $('#moretext_' + rank).show({
                        duration:   'fast',
                        complete:   function() {
                            dfd.resolve(true);
                        }
                    });
                }
            });

            // Return the promise
            return dfd;
        },


        /**
         * <lazy_context>.img_err_h300()
         *
         * Definitively hide the image sections
         *
         * Image section is given by unique image id::"art_body_section_img_<rank>_<sectionNum>#<image_number>"
         *
         * /!\ ASYNC --> RETURNS A PROMISE
         *
         */
        img_err_h300: function() {
            var img    = this,
                img_id = img.dom.id,
                art_body_section_img_id = img_id.split('#')[0],
                dfd    = $.Deferred();
            //alert('Hiding : ' + art_body_section_img_id);

            $('#' + art_body_section_img_id).hide({
                duration: 'fast',
                complete: function(){ 
                  dfd.resolve(true);
                }
            });

            // Return the promise
            return dfd;
        },


        /**
         * <lazy_context>.display_summary_cb()
         *
         * Where <lazy_context> is  our traditional context :
         *    { 
         *           lazy_class: the_lazy_class
         *           dom:         Image() , // the REAL document image associated to the document 
         *           context: orig_context (as above)
         *    }
         *
         * orig_context = {
         *    lazy_clas:  my_lazy_class
         *    ajax: {
         *        done: function(lazy_context) //custom function bound to img+ object once loaded
         *        fail: function(lazy_context) //custom function
         *    }
         * }
         *
         * /!\ ASYNC --> RETURNS A PROMISE
         *
         */
        display_summary_cb: function(rank) { // seq-sync
            var dfd    = $.Deferred();

            //alert("--> display_summary_cb(" + rank + ')');
            $('#moretext_' + rank).show('fast', resolve_dfd.bind(dfd) );

            return dfd;

        }, /* display_summary_cb() */


        /**
         * display_fulltext(rank)
         *
         * Called by "more_text" <a...> onclick
         *
         * /!\ ASYNC --> RETURNS A PROMISE
         *
         */
        display_fulltext: function(rank) { // seq-async
            if ( rank ) {
                //console.log('--> display fulltext(' + rank + ')');
                var fulltext              = $("#art_body_"    + rank),
                    fulltext_img_sections = $('div.art_body_section_img.rank_' + rank),
                    img_sections          = fulltext_img_sections.toArray(),
                    sd_fulltext           = state.display.fulltext,
                    aseq                  = [],
                    dfd                   = GUI_TOKEN_get();

                if (!dfd) {
                    // Token not available. Action cannot be performed
                    return false;
                }

                // expand and show fulltext section
                if ( ! fulltext.is(":visible") ) {
                    generate_body_images(rank);
                    generate_body_posts(rank);
                    
                    aseq.push(
                        // Hide summary
                        shfactory( $('#art_summary_' + rank), m_hide),
                        // Show fulltext
                        shfactory(  fulltext,
                                    m_show,
                                    'fast',
                                    function() { 
                                        // Starting carousel for posts
                                        // Each panel of min-250px takes 260px + initial delta of 75px
                                        // => 595 for 2
                                        // => 855 for 3...
                                        // Receives the factory dfd thru this
                                        $("#art_posts_" + rank)
                                            .owlCarousel({
                                                items:             8,
                                                itemsCustom:       [[0,1],[335,1],[595,2],[855,3],[1115,4],[1375,5],[1635,6],[1895,7],[2154,8]],
                                                slideSpeed:        400,
                                                autoPlay:          5000,
                                                stopOnHover:       true,
                                                navigation:        true,
                                                rewindNav:         false,
                                                paginationNumbers: true,
                                                responsiveRefreshRate: 1000,
                                                autoHeight:        false
                                            });
                                        this.resolve(true);
                    }));

                    // If we are offline, iand since that is the 1st time we
                    // open this article, the images have not been loaded,
                    // therefore we should display the full text
                    // without the image sections, so we hide the image 
                    // sections
                    if ( ! state.navbar.internet ) {
                        // alert('[fulltext] we are offline, we set to hide the image sections');
                        for(var i=0, len=img_sections.length; i<len; i++) {
                            //  alert('[fulltext] 3. Hiding image section');
                            // console.log('[offline] ASEQ:: shutting image section:' + rank + ',' + i);
                            aseq.push(
                                //shfactory($(img_sections[i]), m_hide, null, null, '[offline] shutting image section:' + rank + ',' + i)
                                shfactory($(img_sections[i]), m_hide)
                            );
                        }
                    }
                }

                aseq.push(
                    animatefactory(
                        $htmlbody,  //$html
                        {scrollTop: $('#art_container_' + rank).offset().top - $tij_header.height() - 98},
                        'slow'
                        //, null,
                        //'[fulltext] scrolling up:' + rank
                    )
                );
                
                // Status of the article's fulltext display
                if ( ! sd_fulltext[rank] ) {
                    if ( $('img.img_set_' + rank).length > 0 ) {
                        sd_fulltext[rank] = {
                            done:   false,
                            loaded: false
                        };
                    }
                    else {
                        sd_fulltext[rank] = {
                            done:   true,
                            loaded: false
                        };
                    }
                }

                // Load images unless we are offline (multiple image sections)
                if ( state.navbar.internet && !sd_fulltext[rank].done && !sd_fulltext[rank].loaded ) {
                    // show all body_section_images
                    if ( ! fulltext_img_sections.first().is(":visible") ) {
                        for(var i=0, len=img_sections.length; i<len; i++) {
                            aseq.push( 
                                shfactory($(img_sections[i]), m_show)
                                //shfactory($(img_sections[i]), m_show,null,null, '[Fulltext] online: showing image section:' + rank + ',' + i) 
                            );
                        }
                    }

                    // alert('[fulltext] Number of sections to handle:' + fulltext_img_sections.length);
                    //  alert('[fulltext] loading photos...');
                    // Then load the photos
                    aseq.push(
                        function() {
                            //console.log('[Fulltext] online: loading images:' + rank );
                            TIJ.lazy_batch.apply({
                                jqSelector: 'img.img_set_' + rank,
                                lazy_class: 'lazy h300',
                                ajax:   {
                                    alldone: display_fulltext_images_cb,
                                    fail:    TIJ.img_err_h300
                                },
                                rank: rank
                            })
                        }
                    );
                }

                // Launch the aseq
                // alert('[fulltext] Launching aseq:' + aseq.length);
                //$.when( TIJ.async(aseq) ).always( resolve_dfd.bind(dfd) );
                $.async(aseq).always( resolve_dfd.bind(dfd) );

                return dfd;
            }
            else {
                return false;
            }
        }, /* display_fulltext() */


        /**
         * img_elt.lazy_one(context)
         *
         * Lazy load ONE image : 'this' must be the Img() DOM object
         * 
         * /!\ ASYNC --> RETURNS A PROMISE (via lazy_one_load) 
         *
         */
        lazy_one: function(context) { // 'this' contains the image element on which to do the lazy load
 //alert('--> lazy_one(' + context.rank + ')' );
          return TIJ.lazy_one_load.apply(
              {
                  lazy_class:   context.lazy_class || 'pluggin_lazy',
                  dom:     this,
                  context: context
               }
          );
 //alert('<-- lazy_one(' + context.rank + ')' );
        }, /* lazy_one() */


        /**
         * <lazy_context>.lazy_one_load()
         *
         * where
         *
         * context = {
         *    lazy_class: 
         *    dom:          Image() elt (DOM)
         *    context:      global context (as above), SHARED BY ALL... (cool to share knowledge !!!)
         * }
         * 
         * /!\ ASYNC --> RETURNS A PROMISE
         *
         */
        lazy_one_load: function() {
            var img = this,
                dfd = $.Deferred();
            //alert('--> lazy_one_load(' + img.context.rank + ')' );
          
            //alert("[TIJ.lazy_one_load] src:" + img.dom.src + " name:" + img.dom.name  + "rank: " + img.context.rank + " (press enter when ready to load image...)");
            $(img.dom).imagesLoaded()
                .done( function( imagesLoaded ) {
                    //alert('LOADONE -> OK');
                    $.when( TIJ.lazy_one_load_done.apply(img) ).always( function(){
                        dfd.resolve(true);
                        //alert('<-- RESOLVED lazy_one_load(' + img.context.rank + ') (OK image)' );
                    });
                })
                .fail( function() {
                    $.when( TIJ.lazy_one_load_fail.apply(img) ).always( function(){
                        dfd.resolve(true);
                        //alert('<-- RESOLVED lazy_one_load(' + img.context.rank + ') (KO image)' );
                    });
                });

            // Trigger Images Loading...
            img.dom.src = img.dom.name ;

        //alert('<-- lazy_one_load(' + img.context.rank + ')' );
        return dfd;

        }, /* lazy_one_load() */


        /**
         * <context>.lazy_batch()
         *
         * Lazy load a batch of many images
         *
         * <context> = {
         *             jqSelector:      'img.img_set_<rank>'    
         *             lazy_class:      'lazy h300',
         *             ajax:   {
         *                 alldone:  when the batch is over
         *                 done:     when one image is loaded
         *                 fail:     when one image is broken
         *             },
         *             ... custom_data (rank, etc...)
         * }
         * 
         * /!\ ASYNC --> RETURNS A PROMISE 
         *
         */
        lazy_batch: function() {
            var context = this,
                dfd     = $.Deferred(),
                lazy_class     = context.lazy_class || 'pluggin_lazy',
                jqBatch        = $(context.jqSelector),
                jqBatch_length = jqBatch.length,
            //alert('--> lazy_batch rank:' + context.rank + ' selector:' + context.jqSelector + ' nbimages:' + jqBatch.length);
                batch        = {},

                on_alldone   = function() { //'this' should be an imagesLoaded() object
                    if ( context.ajax && context.ajax.alldone ) {
                        $.when(
                            context.ajax.alldone.apply({
                                imagesLoaded:   this,
                                jqBatch:        jqBatch,
                                batch:          batch,
                                lazy_class:     lazy_class,
                                context:        context
                            })
                        ).always( function() { 
                            dfd.resolve(true);
 //alert('<-- RESOLVED (AFTER callback) lazy_batch(' + context.rank + ')' );
                        });
                    }
                    else {
 //alert('<-- RESOLVED (no callback) lazy_batch(' + context.rank + ')' );
                        dfd.resolve(true);
                    }
                };

            // Empty batch. Just do the DONE function, if it exists
            if ( jqBatch_length == 0 ) {
                on_alldone.apply( {} );
            }
            else {
                // Prepare individual <lazy_context>s
                var jqBatch_list = jqBatch.toArray(),
                    i = 0;

                for(; i<jqBatch_length; i++) {
                    var img_dom = jqBatch_list[i];
                    // Prepare 'img+'   context
                    // /!\ UNIQUE ID => id = // "art_body_section_img_<rank>_<sectionNum>#<image_number>"
                    // Generated by generate_body_images()
                    batch[ img_dom.id ] = {
                        lazy_class:     lazy_class,
                        dom:            img_dom,
                        context:        context
                    };
                }

                var n_resolved = 0;
                jqBatch.imagesLoaded()
                    .progress( function( instance, image ) {
                        var img = batch[ image.img.id ]; // generated during <bodyimg> expansion

                        //alert('[lazy batch] (Progress) image#' + image.img.id + ' loaded: ' + image.img.src + ' status:' + image.isLoaded + 'DOM:' + img.dom);
                        if (image.isLoaded) {
                            //alert('    lazy_batch(' + context.rank + ') Progress +1 LOADED OK' );
                            $.when( TIJ.lazy_one_load_done.apply(img) ).always( function() {
                                n_resolved++;
                                if ( n_resolved == jqBatch_length ) {
                                    //alert('    lazy_batch(' + context.rank + ') BATCH DONE (BEFORE callback)' );
                                    on_alldone.apply( instance );
                                    //alert('    lazy_batch(' + context.rank + ')  BATCH DONE (AFTER callback)' );
                                }
                            });
                        }
                        else {
                            //alert('    lazy_batch(' + context.rank + ') Progress +1 NOT LOADED KO' );
                            $.when( TIJ.lazy_one_load_fail.apply(img) ).always( function(instance, image) {
                                n_resolved++;
                                if ( n_resolved == jqBatch_length ) {
                                    //alert('    lazy_batch(' + context.rank + ') +1 BATCH DONE (BEFORE callback)' );
                                    on_alldone.apply( instance );
                                    //alert('    lazy_batch(' + context.rank + ') +1 BATCH DONE (AFTER callback)' );
                                }
                            });
                        }
                    });
                    /* .always( function( imagesLoaded ) { //on_alldone.apply( imagesLoaded ); }) */

                // Trigger Images Loading...
                for(i=0; i<jqBatch_length; i++) {
                    var img_dom = jqBatch_list[i];
                    img_dom.src = img_dom.name ;
                }
            }

 //alert('<-- lazy_batch(' + context.rank + ')' );
            return dfd;
        }, /* lazy_batch() */


        /**
         * context.lazy_one_load_done()
         * 
         * /!\ ASYNC --> RETURNS A PROMISE
         *
         */
        lazy_one_load_done: function() {
            var img = this,
                dfd = $.Deferred(),
            //alert('--> lazy_one_load_done(' + img.context.rank + ')' );
            // alert("[lazy_one_load_done] rank:" + img.context.rank + " src:" + img.dom.src + " is now loaded from name:" + this.dom.name + " Width:" +  this.dom.width + " Height:" + this.dom.height );

            // Pattern to allow time for image to *effectively* load from browser's cache
                foo,
                n = 0;  // Anti-looping control...

            foo = function() {
                // alert('FOO(' + n + ') width:' + img.dom.width + ' height:' + img.dom.height);
                if ( n > 2 ) {
                    $.when( TIJ.lazy_one_load_fail.apply(img) ).always( function() { dfd.resolve(true); } );
                }
                else {
                    if (img.dom.height > 0 && img.dom.width > 0) {
                        if ( img.context.ajax && img.context.ajax.done ) {
                            $.when( img.context.ajax.done.apply(img) ).always( function() { 
                                // alert('<-- (FOO) RESOLVED lazy_one_load_done(' + img.context.rank + ') callback done foo(' + n + ')' );
                                dfd.resolve(true);
                            });
                        }
                        else {
                            // alert('<-- (FOO) RESOLVED lazy_one_load_done(' + img.context.rank + ') no callback foo(' + n + ')' );
                            // alert('FINAL CLASS(' + img.dom.src + ') = ' + $(img.dom).attr('class'));
                            dfd.resolve(true);
                        }
                    }
                    else {
                        n++;
                        setTimeout(foo, 100);
                    }
                }
            };
          
            // Adjust image class
            // alert(' class:' + $(img.dom).attr('class'));
            $(img.dom).removeClass( img.lazy_class );
            // alert(' Removing class:(' + img.lazy_class + ") ==> " + $(img.dom).attr('class'));
            foo();

            //alert('<-- lazy_one_load_done(' + img.context.rank + ')' );
            return dfd;
        }, /* lazy_one_load_done() */


        /**
         * context.lazy_one_load_fail()
         * 
         * /!\ ASYNC --> RETURNS A PROMISE
         *
         */
        lazy_one_load_fail: function() {
            var img = this,
                dfd = $.Deferred();
            //alert('--> lazy_one_load_fail(' + img.dom.id + ')' );

            $(img.dom).removeClass( img.lazy_class );

            if ( img.context.ajax && img.context.ajax.fail ) {
                $.when( img.context.ajax.fail.apply(img) ).always( function() {
                    dfd.resolve(true);
                    //alert('<-- RESOLVED lazy_one_load_fail(' + img.context.rank + ') callback done' );
                });
            }
            else {
                dfd.resolve(true);
                //alert('<-- RESOLVED lazy_one_load_fail(' + img.context.rank + ') no callback' );
            }

            //alert('<-- lazy_one_load_fail(' + img.context.rank + ')' );
            return dfd;
        }, /* lazy_one_load_fail() */


        /*******************************
         * CONSOLE
         ********************************
         */
        console: function(msg) {
            if (console_timer_id !== null) {
                clearTimeout(console_timer_id);
                console_timer_id = null;
            }

            $console.html(msg).fadeIn({
                duration: 'fast',
                complete: function() {
                    console_timer_id = setTimeout( 
                        function() { 
                            console_timer_id = null;
                            $console.fadeOut('slow');
                        },
                        3000
                    );
                }
            });
        }, /* console */


        /*******************************
         * MESSAGE OF THE DAY
         ********************************
         */
        mod: function(html) {
            if (html) {
                $mod.html( html );
            }
            if ( $mod.html() ) {
                $mod.show();
            }
        },


        /*******************************
         * BOOKMARKS / LOCALSTORAGE
         *
         * <div class="bookmk on/off></div>
         ********************************
         */
        bm_open_panel: function(){
            var dfd = $.Deferred();
            $bm.animate(
                { width: 300},
                { duration: 'fast', 
                  complete: function(){
                     $bm_close.fadeIn(100);
                     $bm.css('overflow', 'auto');
                     dfd.resolve(true);
                  }
            });
            return dfd;
        },

        bm_close_panel: function(){
            var dfd = $.Deferred();
            $bm.css('overflow', 'hidden');
            $bm_close.fadeOut(100,
                function(){
                    $bm.animate(
                        { width: 0 },
                        {duration: 'fast', complete: resolve_dfd.bind(dfd) }
                    )
                }
            );
            return dfd;
        },


        /**
         * GOTO a bookmark
         *
         */
        bm_goto_bookmark: function(lskey, url) {
            //console.log('[GOTO Bookmark] lskey=' + lskey);
            var stardiv   = bm_local_keys[lskey];

            //console.log('[GOTO Bookmark] lskey=' + lskey + ' rank:' + rank + ' buttonid:' + buttonid + ' url:' + url);
            TIJ.bm_close_panel();

            if ( stardiv ) {
                var rank      = stardiv.rank,
                    navbutton = state.navbutton[rank],
                    buttonid  = navbutton.id;

                if (state.navbar.rubbar.button[buttonid].selected ) {
                    // simply open the article
                    TIJ.activate_menu(rank);
                }
                else {
                    // Open the good rubrique first
                    // Then the article
                    $.when( TIJ.toggle_rubrique.call(navbutton) ).always(
                        TIJ.activate_menu.bind(null, rank)
                    )
                }
            }
            else {
                var md5id = (localStorage[lskey].split('|'))[0];
                window.open(url, md5id);
            }
        },


        /**
         * Bookmark/unbookmark an article from the 
         * current journal by clicking on the star
         * close to the article on the TOC.
         */
        bookmark: function(div, remove) {
            var rank    = div.rank,
                jq      = $(div),
                lskey   = div.lskey;

            if ( div.bookmarked || remove ) {
                // Remove bookmark

                // Update localStorage
                delete localStorage[lskey];
                delete bm_keys_hash[lskey];

                // Recompute bookmarks hash
                localStorage[LS_BOOKMARKS_KEY] = $.keys(bm_keys_hash).join('|');
                //console.log('[Click::Remove Bookmark] RECOMPUTED BOOKMARKS: ' + localStorage[LS_BOOKMARKS_KEY]);

                // Update icon appearance
                div.bookmarked = false;
                jq.removeClass('on').addClass('off');

                // update bookmarks'panel display
                TIJ.bm_rm_from_panel(lskey);
                //console.log('UNBOOKMARK key:' + lskey);
            }
            else {
                // Add bookmark (tag + note)
                $.when( get_bmtag(rank) ).always( function(tag) {
                    var date    = div.dmy,
                        title   = state.titles[rank],
                        note    = $bm_note[0].value || '';

                    //alert('GOT TAG: (' + tag  + ')');
                    //alert('GOT NOTE: (' + note  + ')');

                    // Update localStorage
                    localStorage[lskey] = [JID, rank, tag, date, title, note].join('|');
                    bm_keys_hash[lskey] = lskey;

                    // Recompute bookmarks hash
                    localStorage[LS_BOOKMARKS_KEY] = $.keys(bm_keys_hash).join('|');
                    //console.log('[Click::Add Bookmark] RECOMPUTED BOOKMARKS: ' + localStorage[LS_BOOKMARKS_KEY]);

                    // Update icon appearance
                    div.bookmarked = true;
                    jq.removeClass('off').addClass('on');

                    // Update the bookmark panel
                    var $node = TIJ.bm_add_to_panel(lskey, true);
                    if (note) {
                        state.tt[ $node.attr('id') ] = note;
                        $node.hover(tt_hover, tt_hide).mousemove( tt_mouse );
                    }
                });
            }
        },


        /**
         * Add a bookmark to the bookmark panel
         *
         * return the jq node
         */
        bm_add_to_panel: function(lskey, close_panel_flag) {
            var data         = localStorage[lskey].split('|'),
                data_id      = bm_data_id[lskey] = 'bm_data_' + bm_data_n++,
                //data_rm_id   = data_id + '_rm';
                md5id        = data[0],
                $jqBmSection = TIJ.bm_add_tag( data[2] ),
                url          = localStorage[LS_JTI_KEY + md5id + '.url'],

            //var md5id  = data[0],
            //    rank   = data[1];
            //    tag    = data[2],
            //    date   = data[3],
            //    title  = data[4],
            //    note   = data[5],

            /*
             * Create a new node into the bookmark panel:
             *
             * <div id="bm_data_<nnn>"
             *      class="bm_data"
             *      section="bm_section_<ppp>">
             *   <div class="bm_title">Title (date) </div>
             *   <div //id="bm_data_<nnn>_rm" 
             *        class="bm_rm" 
             *        //lskey="onr.jti.<md5id>.<rank>">
             *   </div>
             * </div>
             */
                node = TIJ.ssprintf(
                    bm_pattern_data, 
                    data_id,                    // Node's id
                    $jqBmSection.attr('id'),    // Id ot its section parent
                    data[3],                    // Article's date
                    data[4],                    // Article's title
                    md5id == JID ? 'local':''   // Local article (md5id eq JID)
            );
            /*
                    data_rm_id,                 // Id of associated delete element
                    lskey                       // and its lskey
            );
            */
            $jqBmSection.children('fieldset').append(node);

            // Plug click handlers to new node
            var $node = $('#' + data_id);
            $node[0].note = data[5];

            // Handler to open or load bookmarked article
            $node.click( TIJ.bm_goto_bookmark.bind( null, lskey, url) );

            // Handler to remove the node when clicking on the garbage
            //$('#' + data_rm_id).click( TIJ.bm_click_garbage.bind(lskey) );
            $node.children('.bm_rm').click( TIJ.bm_click_garbage.bind(null,lskey) );

            // Add click handler to the rm sub element
            /*
            var click_handler =  function(){
                var div = this,
                    lskey = $(div).attr('lskey');
                 var elt = lskey ? bm_local_keys[lskey] : 'nodiv';
                 console.log('CLICK(RM FROM PANEL) DIV:' + div + ' lskey:' + lskey + ' ELT:' + elt);
                TIJ.bm_click_garbage.call(div);
            };
            */
            if (close_panel_flag) TIJ.bm_close_panel();
            return $node;
        },


        /**
         * Remove a bookmark from the bookmark panel
         *
         * (Remove a section from the bookmark panel
         *  when it becomes empty)
         */
        bm_rm_from_panel: function(lskey) {
            var data_id      = bm_data_id[lskey],
                $jqBmData    = $('#' + data_id),
                section_id   = $jqBmData.attr('section'),
                section_tag  = bm_section_id[section_id],
                $jqBmSection = $('#' + section_id + ' fieldset');
                //console.log('[bm_rm_from_panel] lskey:' + lskey + ' data_id:' + data_id + ' section_id:' + section_id + ' section_tag:' + section_tag);

            $jqBmData.remove();

            // remove tag section when empty
            if ( $jqBmSection.children('div.bm_data').length == 0 ) {
                //console.log('[bm_rm_from_panel] Prent section is empty (tag:' + section_tag + ' id:' + section_id );
                $jqBmSection.remove();
                delete bm_section_id[section_tag];
                delete bm_section_id[section_id];
            }
        },
        

        /**
         * Remove a bookmark from the bookmark panel
         * from clicking on the panel's garbage
         *
         */
        bm_click_garbage: function(lskey) {
            /*
            var div      = this,
                lskey    = $(div).attr('lskey'),
                stardiv  = bm_local_keys[lskey];
            */
            var stardiv  = bm_local_keys[lskey];

            console.log('[RM from panel] lskey=' + lskey + ' div:' + stardiv);

            if ( stardiv ) {
                TIJ.bookmark(stardiv, true);
            }
            else {
                TIJ.bm_rm_from_panel(lskey);
                delete localStorage[lskey];
                delete bm_keys_hash[lskey];
                localStorage[LS_BOOKMARKS_KEY] = $.keys(bm_keys_hash).join('|');
                console.log('[bm_click_garbage] RECOMPUTED BOOKMARKS: ' + localStorage[LS_BOOKMARKS_KEY]);
            }
        },


        // Add a new bookmark TAG section
        //  <div class="bm_section" id="{0}">
        //     <div class="bm_tag">{1}</div>
        //  </div>',
        // Returns the associated jqBmSection
        bm_add_tag: function(tag) { // tags are normalized
            var section_id = bm_section_id[tag];

            if ( section_id === undefined ) {
                bm_section_id[tag]        = section_id = 'bm_section_' + bm_section_n++;
                bm_section_id[section_id] = tag;
                //console.log('[BM_ADD_TAG] ADDING TAG SECTION(' + tag + '):' + bm_section_id[tag]);

                $bm.append(
                    TIJ.ssprintf(
                        bm_pattern_section, 
                        section_id,
                        tag
                ));
            }

            // jqBmSection
            return $( '#' + section_id );
        },


        /*******************************
         * HELPERS
         ********************************
         */
        /***
         * TIJ.ssprintf("string with {number} ...", var1, var2, ...)
         */
        ssprintf: function(format /*, arg...*/) {
            var args = Array.prototype.slice.call(arguments, 1);
            return format.replace(/{(\d+)}/g, function(match, number) { 
                return typeof args[number] != 'undefined'
                       ? args[number] 
                       : match;
            })
        },


        escape_regexp: ( function() {
            /*
             * Referring to the table here:
             * https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/regexp
             * these characters should be escaped
             * \ ^ $ * + ? . ( ) | { } [ ]
             * These characters only have special meaning inside of brackets
             * they do not need to be escaped, but they MAY be escaped
             * without any adverse effects (to the best of my knowledge and casual testing)
             * : ! , = 
             * my test "~!@#$%^&*(){}[]`/=?+\|-_;:'\",<.>".match(/[\#]/g)
             * test TIJ.escape_regexp("/path/to/res?search=this.that")
             */
            var specials = [
                // order matters for these
                "-",
                "[",
                "]",
                // order doesn't matter for any of these
                "/",
                ".",
                "*",
                "+",
                "?",
                "\\",
                "^",
                "$",
                "|",
                "{",
                "}",
                "(",
                ")"
            ];

            // I choose to escape every character with '\'
            // even though only some strictly require it when inside of []
            var regex = RegExp('[' + specials.join('\\') + ']', 'g');

            return function (s) {
                return s.replace(regex, "\\$&");
            };

        }() ),


        /**
         * async([f1,...], arg...)
         *
         * Must return a promise
         */
        /*
        async: function() {
            var args = [].splice.call(arguments, 0), // To transform the arguments into a true array
                aseq = args.shift(),
                dfd  = $.Deferred(),
                f,
                launch_f,
                foo;

//console.log('--> async seq:' + aseq.length + ' elts');
            foo = function() {
//console.log('    async --> foo ' + aseq.length + ' elts');
                if ( aseq.length == 0 ) {
                    // Oti roa
                    dfd.resolve.apply(null, arguments);
//console.log('<-- async RESOLVED');
                }
                else {
                    f        = aseq.shift();
                    launch_f = $.isFunction(f) ? f.apply(null, arguments) : f;
//console.log('    async foo --> Launching(' + f + ') -->' + launch_f);

                    $.when( 
                        //aseq.shift().apply(null, arguments)
                        launch_f
                    ).always( function() {
//console.log('    async <-- bar resolved. Recurse on foo ');
                        // We receive the return value in arguments
                        // passed to a former resolve(...)
                        // No we recurse on the async sequence
                        foo.apply(null, arguments);
                    });
                }
            };

            // Start the process
            foo.apply(null, args);

            // return the promise
//console.log(dfd + ' <-- async');
            return dfd;
        }
        */
    };

    return tij;
})(jQuery);
