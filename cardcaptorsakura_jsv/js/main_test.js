function create_CCS_chart() {
    ////////////////////////////////////////////////////////////// 
    ////////////////// 设置页面大小 ///////////////////////////////
    ////////////////////////////////////////////////////////////// 
    var container=d3.select("#chart");

    window.scroll(0,window.pageYOffset); //window.scroll 是什么？window.pageYOffset是什么？
    //移除存在的元素
    container.selectAll("svg, canvas").remove();
    container.style("height",null);
    document.body.style.width=null;//document.body.style.width 和 window.innerWidth 区别？

    var base_width=1600;
    var ww=window.innerWidth;//窗口宽度
    var wh=window.innerHeight;//窗口高度
    var width_too_small=ww<500;//窗口过窄

    var width;
    if(wh<ww){ //窗口的高小于宽
        width=wh/0.7
    }else{//窗口的高度大于宽度
        if(ww<width_too_small)width=ww/0.5;
        else if(ww<600)width=ww/0.6;
        else if(ww<800)width=ww/0.7;
        else if(ww<1100)width=ww/0.8;
        else width=ww/0.8;
    }
    width=Math.round(Math.min(base_width,width));//Math.round ?
    var height=width;

    var size_factor=width/base_width;

    container.style("height",height +"px");

    var annotation_padding=width_too_small?0:240*size_factor;
    var total_char_width=width+annotation_padding;
    var no_scrollbar_padding=total_char_width>ww?0:20;
    if(total_char_width>ww)document.body.style.width=total_char_width+'px';
    var outer_container_width=Math.min(base_width,ww-no_scrollbar_padding-2*20);//2 * 20px padding

    ////////////////////////////////////////////////////////////// 
    //////////////////// 创建 SVG & Canvas ///////////////////////
    ////////////////////////////////////////////////////////////// 
    //
    //Canvas
    var canvas=container.append("canvas").attr("id","canvas-target")
    var ctx=canvas.node().getContext("2d");  //canvas.node().getContext？？
    crispyCanvas(canvas,ctx,2); //？
    ctx.translate(width/2,height/2);//？
    //canvas 通用设置
    ctx.globalCompositeOperation="multiply";  //？
    ctx.lineCap="round";  //？
    ctx.lineWidth=3*size_factor;//？
    //SVG 容器
    var svg=container.append("svg")
        .attr("id","CCS-SVG")
        .attr("width",width)
        .attr("height",height);

    var chart=svg.append("g")
        .attr("transform","translate("+(width/2)+","+(height/2)+")");

    var defs=chart.append("defs");

    //////////////////////////////////////////////////////////////
    //////////////// 初始化 helpers and 比例尺scales //////////////
    //////////////////////////////////////////////////////////////

    var num_chapters = 50,
        num_volume = 12;
    var pi2 = 2*Math.PI,
        pi1_2 = Math.PI/2;

    var cover_alpha = 0.3;
    var simulation;
    var remove_text_timer;
    //颜色
    var color_sakura = "#EB5580",
        color_kero = "#F6B42B",
        color_syaoran = "#4fb127";
    //鼠标移入事件mouseover
    var mouse_over_in_action = false;

    ///创建不同部分的半径
    var rad_card_label = width * 0.4, //捕捉卡片外面的文字
        rad_cover_outer = width * 0.395, //outside of the hidden cover hover
        rad_cover_inner = width * 0.350, //inside of the hidden cover hover
        // rad_volume_donut_outer = width * 0.427, //outer radius of the volume donut
        // rad_volume_donut_inner = width * 0.425, //inner radius of the volume donut
        rad_color = width * 0.373, //彩色圆圈的中心
        rad_chapter_outer = width * 0.3499, //隐藏章节的外侧悬停处
        rad_volume_inner = width * 0.343, //体积弧的半径
        rad_chapter_donut_outer = width * 0.334, //章节圈的外侧半径
        rad_chapter_donut_inner = width * 0.32, //章节甜甜圈的内侧半径
        rad_chapter_inner = width * 0.30, //隐藏章节的内侧悬停处
        rad_dot_color = width * 0.32, //章节点
        rad_line_max = 0.31,
        rad_line_min = 0.215,
        rad_line_label = width * 0.29, //解释悬停的文本标签
        rad_donut_inner = width * 0.122, //字符圈的内半径
        rad_donut_outer = width * 0.13, //字符圈的外半径
        rad_name = rad_donut_outer + 8 * size_factor, //在字符圈和start of the character name的 padding
        rad_image = rad_donut_inner - 4 * size_factor; //悬停时显示的中心图像半径
        rad_relation = rad_donut_inner - 8 * size_factor; //在字符圈和inner线之间的padding
    //每个章节的角度
    var  angle=d3.scaleLinear() //d3.scaleLinear?
        .domain([0,num_chapters])
        .range([pi2/num_chapters/2,pi2+pi2/num_chapters/2]);
    //色圈的半径比例
    var radius_scale=d3.scaleSqrt() //d3.scaleSqrt?
        .domain([0,1])
        .range([0,20]);
   ///////////////////////////////////////////////////////////////////////////
    ////////////////////////////读数据/////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////
    d3.queue() //queue?  defer?  await?
        .defer(d3.json,"../data/ccs_chapter_hierarchy.json")
        .defer(d3.json, "../data/ccs_chapter_total.json")
        .defer(d3.json,"../data/ccs_character_per_chapter.json")
        .defer(d3.json,"../data/ccs_character_per_chapter_cover.json")
        .defer(d3.csv,"../data/ccs_character_total.csv")
        .defer(d3.csv,"../data/ccs_character_relations.csv")
        .defer(d3.json,"../data/ccs_color_distribution.json")
        .await(draw);
    
    function draw(error,chapter_hierarchy_data,chapter_total_data,character_data,cover_data,character_total_data,relation_data,color_data){
        console.log(character_total_data);
        if(error)throw error;
        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// 计算章节位置//////////////// /////////////////////
        /////////////////////////////////////////////////////////////////////////// 
        // chapter_hierarchy_data=chapter_hierarchy_data.filter(function(d){return d.name==="CCS"||( d.volume_num <= num_volume && !d.num)||( d.num >=1 && d.num <= num_chapters);});
        // //基于典型的层次聚类示例 ？
        var root =d3.stratify() //d3.stratify? id? parentId?
            .id(function(d){return d.name;})
            .parentId(function(d){return d.parent;})
            (chapter_hierarchy_data);
        var cluster =d3.cluster() //d3.cluster  .size  .separations ???
            .size([360,rad_dot_color])
            .separation(function separation(a,b){
                return a.parent ==b.parent?1: 1.3;
            });
        cluster(root);
        var chapter_location_data= root.leaves()   //d3.stratify().leaves?   .forEach ?
        chapter_location_data.forEach(function(d,i){
            d.centerAngle =d.x * Math.PI /180;
        });
        //属于同一卷的两章之间的距离
        var chapter_angle_distance=chapter_location_data[1].centerAngle-chapter_location_data[0].centerAngle;
        //添加一些有用的章节数据指标
        chapter_location_data.forEach(function (d,i){
            d.startAngle =d.centerAngle -chapter_angle_distance/2;
            d.endAngle =d.centerAngle +chapter_angle_distance /2;
        })
        /////////////////////////////////////////////////////////////////////////
        /////////////////////////// 最终的数据准备 ////////////////////////////////
        /////////////////////////////////////////////////////////////////////////
        character_total_data.forEach(function(d){
            d.num_chapters= +d.num_chapters;
        })
        var character_name=character_total_data.map(function(d){return d.character;});
        //根据total中的字符对cover data 进行排序
        function sortCharacher(a,b){return character_name.indexOf(a.character)-character_name.indexOf(b.character);}
        cover_data.sort(sortCharacher);
        character_data.sort(sortCharacher);



        //////////////////////////////////////////////////////////////
        /////////////// 为封面图片创建圆圈 //////////////////////////////
        //////////////////////////////////////////////////////////////

        //添加人物图片
        var image_radius = rad_image;
        var image_group = defs.append("g").attr("class", "image-group");
        //必须添加 img 宽度，否则它在 Safari 和 Firefox 中不起作用
        //http://stackoverflow.com/questions/36390962/svg-image-tag-not-working-in-safari-and-firefox
        var cover_image = image_group.append("pattern")
            .attr("id", "cover-image")
            .attr("class", "cover-image")
            .attr("patternUnits", "objectBoundingBox")
            .attr("height", "100%")
            .attr("width", "100%")
            .append("image")
            .attr("xlink:href", "../img/white-square.jpg")
            .attr("height", 2 * image_radius)
            .attr("width", 2 * image_radius);

        ///////////////////////////////////////////////////////////////////////////
        //////////////// 创建字符甜甜圈图 ////////////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        //字符圆环图的 Arc 命令
        var arc = d3.arc() //arc？ .outerRadius .innerRadius  .padAngle .cornerRadius？？
            .outerRadius(rad_donut_outer)
            .innerRadius(rad_donut_inner)
            .padAngle(0.01)
            .cornerRadius((rad_donut_outer - rad_donut_inner) / 2 * 1)
        //用于计算甜甜圈切片大小的饼图函数
        var pie = d3.pie()  //pie .sort  .value？
            .sort(null)
            .value(function (d) { return d.num_chapters; });

        var arcs = pie(character_total_data);
        arcs.forEach(function(d,i) {
            d.character = character_total_data[i].character;
            d.centerAngle = (d.endAngle - d.startAngle) / 2 + d.startAngle;
        });

        //创建每个角色的甜甜圈切片（以及它们出现的章节数）
        var donut_group = chart.append("g").attr("class", "donut-group");
        var slice = donut_group.selectAll(".arc")
            .data(arcs)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc)
            .style("fill", function (d) { return d.data.color; });
        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////// 创建名字标签 //////////////////////////
        ///////////////////////////////////////////////////////////////////////////
        var hover_circle_group = chart.append("g").attr("class", "hover-circle-group");
        var name_group = chart.append("g").attr("class", "name-group");

        //为每个角色创建一个组
        var names = name_group.selectAll(".name")
            .data(arcs)
            .enter().append("g")
            .attr("class", "name")
            .style("text-anchor", function (d) { return d.centerAngle > 0 & d.centerAngle < Math.PI ? "start" : "end";; })
            .style("font-family", "Anime Ace")

        //添加一个大的 "main" 名字
        names.append("text")
            .attr("class", "name-label")
            .attr("id", function (d, i) { return "name-label-" + i; })
            .attr("dy", ".35em")
            .attr("transform", function (d, i) {
                //If there is a last name, move the first a bit upward
                if(character_total_data[i].last_name !== "") {
                    var finalAngle = d.centerAngle + (d.centerAngle > 0 & d.centerAngle < Math.PI ? -0.02 : 0.02);
                } else {
                    var finalAngle = d.centerAngle;
                }//else
                return "rotate(" + (finalAngle * 180 / Math.PI - 90) + ")"
                    + "translate(" + rad_name + ")"
                    + (finalAngle > 0 & finalAngle < Math.PI ? "" : "rotate(180)");
            })
            .style("font-size", (12*size_factor)+"px")
            .text(function (d, i) { return character_total_data[i].first_name; });

        //在后面添加一个小的姓氏
        names.append("text")
            .attr("class", "last-name-label")
            .attr("id", function (d, i) { return "last-name-label-" + i; })
            .attr("dy", ".35em")
            .attr("transform", function (d, i) {
                //If there is a last name, move the last a bit downward
                if(character_total_data[i].last_name !== "") {
                    var finalAngle = d.centerAngle + (d.centerAngle > 0 & d.centerAngle < Math.PI ? 0.03 : -0.03);
                } else {
                    var finalAngle = d.centerAngle;
                }//else
                return "rotate(" + (finalAngle * 180 / Math.PI - 90) + ")"
                    + "translate(" + rad_name + ")"
                    + (finalAngle > 0 & finalAngle < Math.PI ? "" : "rotate(180)");
            })
            .style("font-size", (9*size_factor)+"px")
            .text(function (d, i) { return character_total_data[i].last_name; });

        //增加一行 添加一个classmate
        names.filter(function(d,i) { return i === arcs.length - 1; })
            .append("text")
            .attr("class", "last-name-label")
            .attr("dy", ".35em")
            .attr("y", "1.35em")
            .attr("transform", function (d, i) {
                var finalAngle = (d.endAngle - d.startAngle) / 2 + d.startAngle - 0.03;
                return "rotate(" + (finalAngle * 180 / Math.PI - 90) + ")"
                    + "translate(" + rad_name + ")rotate(180)";
            })
            .style("font-size", (9*size_factor)+"px")
            .text("Rika, Yamazaki");
        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////// 创建名字后面的点 ////////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        var characterByName = [];
        //名称后面的点的颜色可以是类型
        character_total_data.forEach(function (d, i) {
            var text_width_first = document.getElementById('name-label-' + i).getComputedTextLength();
            var text_width_last = document.getElementById('last-name-label-' + i).getComputedTextLength();
            d.dot_name_rad = rad_name + Math.max(text_width_first,text_width_last) + 10;
            d.name_angle = (arcs[i].endAngle - arcs[i].startAngle) / 2 + arcs[i].startAngle;

            characterByName[d.character] = d;
        })//forEach

        //在每个字符的每个名称的末尾添加一个圆圈
        var name_dot_group = chart.append("g").attr("class", "name-dot-group");
        var name_dot = name_dot_group.selectAll(".type-dot")
            .data(character_total_data)
            .enter().append("circle")
            .attr("class", "type-dot")
            .attr("cx", function (d) { return d.dot_name_rad * Math.cos(d.name_angle - pi1_2); })
            .attr("cy", function (d) { return d.dot_name_rad * Math.sin(d.name_angle - pi1_2); })
            .attr("r", 6 * size_factor)
            .style("fill", function (d) { return d.color; })
            .style("stroke", "white")
            .style("stroke-width", 3 * size_factor);

        ///////////////////////////////////////////////////////////////////////////
        ////////////////////////// 创建内部关系 /////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        var pull_scale = d3.scaleLinear()
            .domain([2 * rad_relation, 0])
            .range([0.7, 2.3]);
        var color_relation = d3.scaleOrdinal()
            .domain(["family", "crush", "love", "friends", "master"]) //"teacher","ex-lovers","reincarnation","rival"
            .range(["#2C9AC6", "#FA88A8", "#E01A25", "#7EB852", "#F6B42B"])
            .unknown("#bbbbbb");
        var stroke_relation = d3.scaleOrdinal()
            .domain(["family", "crush", "love", "friends", "master"]) //"teacher","ex-lovers","reincarnation","rival"
            .range([4, 5, 8, 4, 5])
            .unknown(3);

        var relation_group = chart.append("g").attr("class", "relation-group");

        //在具有关系的人物之间创建area
        var relation_lines = relation_group.selectAll(".relation-path")
            .data(relation_data)
            .enter().append("path")
            .attr("class", "relation-path")
            .style("fill", "none")
            .style("stroke", function (d) { return color_relation(d.type); })
            .style("stroke-width", function (d) { return stroke_relation(d.type) * size_factor; })
            .style("stroke-linecap", "round")
            .style("mix-blend-mode", "multiply")
            .style("opacity", 0.7)
            .attr("d", create_relation_lines);

        function create_relation_lines(d) {
            var source_a = characterByName[d.source].name_angle,
                target_a = characterByName[d.target].name_angle;
            var x1 = rad_relation * Math.cos(source_a - pi1_2),
                y1 = rad_relation * Math.sin(source_a - pi1_2),
                x2 = rad_relation * Math.cos(target_a - pi1_2),
                y2 = rad_relation * Math.sin(target_a - pi1_2);
            var dx = x2 - x1,
                dy = y2 - y1,
                dr = Math.sqrt(dx * dx + dy * dy);
            var curve = dr * 1 / pull_scale(dr);

            //获得角度来确定最佳扫描标志
            var delta_angle = (target_a - source_a) / Math.PI;
            var sweep_flag = 0;
            if ((delta_angle > -1 && delta_angle <= 0) || (delta_angle > 1 && delta_angle <= 2))
                sweep_flag = 1;

            return "M" + x1 + "," + y1 + " A" + curve + "," + curve + " 0 0 " + sweep_flag + " " + x2 + "," + y2;
        }//function create_relation_lines
        ///////////////////////////////////////////////////////////////////////////
        /////////////////////创建内部关系悬停区域 ////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        var relation_hover_group = chart.append("g").attr("class", "relation-hover-group");
        var relation_hover_lines = relation_hover_group.selectAll(".relation-hover-path")
            .data(relation_data)
            .enter().append("path")
            .attr("class", "relation-hover-path")
            .style("fill", "none")
            .style("stroke", "white")
            .style("stroke-width", 16 * size_factor)
            .style("opacity", 0)
            // .style("pointer-events", "all")
            .attr("d", create_relation_lines)
            .on("mouseover", mouse_over_relation)
            .on("mouseout", mouse_out)

        //调用并创建注释的文本部分
        var annotation_relation_group = chart.append("g").attr("class", "annotation-relation-group");

        function mouse_over_relation(d,i) {
            d3.event.stopPropagation();
            mouse_over_in_action = true;

            clearTimeout(remove_text_timer);

            //只显示鼠标悬停的关系
            relation_lines.filter(function(c,j) { return j !== i; })
                .style("opacity", 0.05);

            //设置注释
            var annotations_relationship = [
                {
                    note: {
                        label: d.note,
                        title: capitalizeFirstLetter(d.type),
                        wrap: 150*size_factor,
                    },
                    relation_type: "family",
                    x: +d.x * size_factor,
                    y: +d.y * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                }
            ];

            var makeAnnotationsRelationship = d3.annotation()
                // .editMode(true)
                .type(d3.annotationLabel)
                .annotations(annotations_relationship);
            annotation_relation_group.call(makeAnnotationsRelationship);

            //更新样式
            annotation_relation_group.selectAll(".note-line, .connector")
                .style("stroke", "none");
            annotation_relation_group.select(".annotation-note-title")
                .style("fill", color_relation(d.type) === "#bbbbbb" ? "#9e9e9e" : color_relation(d.type));

        }//function mouse_over_relation
        ///////////////////////////////////////////////////////////////////////////
        //////////////////////// 创建遮盖的章节圈 //////////////////////
        ///////////////////////////////////////////////////////////////////////////

        //在中心添加一个圆圈，显示悬停上的封面图像
        var cover_circle_group = chart.append("g").attr("class", "cover-circle-group");
        var cover_circle = cover_circle_group.append("circle")
            .attr("class", "cover-circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", rad_image)
            .style("fill", "none");


        ///////////////////////////////////////////////////////////////////////////
        ////////////////////// 创建隐藏名称悬停区域 //////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        //创建悬停圈，显示当您悬停在字符上时
        var rad_hover_circle = 35 * size_factor;
        var hover_circle = hover_circle_group.selectAll(".hover-circle")
            .data(character_total_data)
            .enter().append("circle")
            .attr("class", "hover-circle")
            .attr("cx", function (d) { return d.dot_name_rad * Math.cos(d.name_angle - pi1_2); })
            .attr("cy", function (d) { return d.dot_name_rad * Math.sin(d.name_angle - pi1_2); })
            .attr("r", rad_hover_circle)
            .style("fill", function (d) { return d.color; })
            .style("fill-opacity", 0.3)
            .style("opacity", 0);
        var arc_character_hover = d3.arc()
            .outerRadius(function(d,i) { return character_total_data[i].dot_name_rad + rad_hover_circle; })
            .innerRadius(rad_donut_inner)

        //创建每个字符的甜甜圈切片（以及它们出现在的章节数）
        var character_hover_group = chart.append("g").attr("class", "character-hover-group");
        var character_hover = character_hover_group.selectAll(".character-hover-arc")
            .data(arcs)
            .enter().append("path")
            .attr("class", "character-hover-arc")
            .attr("d", arc_character_hover)
            .style("fill", "none")
            .style("pointer-events", "all")
            .on("mouseover", mouse_over_character)
            .on("mouseout", mouse_out);

        function mouse_over_character(d) {
            d3.event.stopPropagation();
            mouse_over_in_action = true;

            //显示所选的线
            ctx.clearRect(-width/2, -height/2, width, height);
            ctx.globalAlpha = 0.8;
            create_lines("character", character_data.filter(function(c,j) {return c.character === d.character; }) );

            //更新标签路径
            // line_label_path.attr("d", label_arc(characterByName[d.character].name_angle));
            // //更新label文本
            // clearTimeout(remove_text_timer);
            // var label_words = d.character === "Classmates" ? "Naoko, Chiharu, Rika and/or Yamazaki appear" : d.character === "Nakuru" ? "Ruby Moon (also known as Nakuru) appears" : d.character === "Spinel" ? "Spinel Sun appears" : d.character + " appears";
            // line_label.text("chapters that " + label_words + " in");

            //突出显示此人物出现的章节
            var char_chapters = character_data
                .filter(function(c) { return c.character === d.character; })
                .map(function(c) { return c.chapter; });
            var char_color = characterByName[d.character].color;
            chapter_hover_slice.filter(function(c,j) { return char_chapters.indexOf(j+1) >= 0; })
                .style("fill", char_color)
                .style("stroke", char_color);
            chapter_number.filter(function(c,j) { return char_chapters.indexOf(j+1) >= 0; })
                .style("fill", "white");
            chapter_dot.filter(function(c,j) { return char_chapters.indexOf(j+1) >= 0; })
                .attr("r", chapter_dot_rad * 1.5)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", char_color);

            //显示中心中的字符图像
            cover_image.attr("xlink:href", "../img/character-" + d.character.toLowerCase() + ".jpg")
            cover_circle.style("fill", "url(#cover-image)");

            //显示悬停圈
            hover_circle.filter(function(c) { return d.character === c.character; })
                .style("opacity", 1);

        }//function mouse_over_character

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// 创建章节甜甜圈图 //////////////////////
        ///////////////////////////////////////////////////////////////////////////

        //按正确的顺序去创建一个group
        var chapter_group = chart.append("g").attr("class", "chapter-group");
        var donut_chapter_group = chapter_group.append("g").attr("class", "donut-chapter-group");
        var chapter_dot_group = chapter_group.append("g").attr("class", "chapter-dot-group");
        var donut_chapter_hover_group = chapter_group.append("g").attr("class", "donut-chapter_hover-group");
        var chapter_num_group = chapter_group.append("g").attr("class", "chapter-number-group");

        //通过arc 命令得到章节号码甜甜圈
        var arc_chapter = d3.arc()
            .outerRadius(rad_chapter_donut_outer)
            .innerRadius(rad_chapter_donut_inner)
            .padAngle(0.01)
            .cornerRadius((rad_chapter_donut_outer - rad_chapter_donut_inner) / 2)

        //创建每个字符的甜甜圈切片（以及它们出现在的章节数）
        var chapter_slice = donut_chapter_group.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter)
            .style("fill", "none")
            .style("stroke", "#c4c4c4")
            .style("stroke-width", 1 * size_factor);
        //创建每个字符的甜甜圈切片的遮罩（以及它们出现在的章节数）
        var chapter_hover_slice = donut_chapter_hover_group.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", 1.5 * size_factor);

        //T文本位于每个甜甜圈切片的中心
        var rad_chapter_donut_half = ((rad_chapter_donut_outer - rad_chapter_donut_inner) / 2 + rad_chapter_donut_inner);

        //添加章节号文本
        var chapter_number = chapter_num_group.selectAll(".chapter-number")
            .data(chapter_location_data)
            .enter().append("text")
            .attr("class", "chapter-number")
            .style("text-anchor", "middle")
            .attr("dy", ".35em")
            .attr("transform", function (d, i) {
                var angle = d.centerAngle * 180 / Math.PI - 90;
                return "rotate(" + angle + ")translate(" + rad_chapter_donut_half + ")" +
                    // (d.centerAngle > 0 & d.centerAngle < Math.PI ? "" : "rotate(180)")
                    "rotate(" + -angle + ")";
            })
            .style("font-size", (9*size_factor) + "px")
            .text(function (d, i) { return i + 1; });

        //在每章切片的内部添加一个圆圈
        var chapter_dot_rad = 3.5 * size_factor;
        var chapter_dot = chapter_dot_group.selectAll(".chapter-dot")
            .data(chapter_location_data)
            .enter().append("circle")
            .attr("class", "chapter-dot")
            .attr("cx", function (d) { return rad_dot_color * Math.cos(d.centerAngle - pi1_2); })
            .attr("cy", function (d) { return rad_dot_color * Math.sin(d.centerAngle - pi1_2); })
            .attr("r", chapter_dot_rad)
            .style("fill", "#c4c4c4")
            .style("stroke", "white")
            .style("stroke-width", chapter_dot_rad * 0.5);

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// 创建体积虚线 ///////////////////////
        ///////////////////////////////////////////////////////////////////////////

        //按顺序创建group
        var donut_volume_group = chart.append("g").attr("class", "donut-volume-group");

        //创建 arcs 数据
        var volume_data = [
            { volume: 1, num_chapters: 5, chapter_start: 1, chapter_end: 5 },
            { volume: 2, num_chapters: 5, chapter_start: 6, chapter_end: 10 },
            { volume: 4, num_chapters: 4, chapter_start: 11, chapter_end: 14 },
            { volume: 3, num_chapters: 4, chapter_start: 15, chapter_end: 18 },
            { volume: 5, num_chapters: 4, chapter_start: 19, chapter_end: 22 },
            { volume: 6, num_chapters: 4, chapter_start: 23, chapter_end: 26 },
            { volume: 7, num_chapters: 4, chapter_start: 27, chapter_end: 30 },
            { volume: 8, num_chapters: 4, chapter_start: 31, chapter_end: 34 },
            { volume: 9, num_chapters: 4, chapter_start: 35, chapter_end: 38 },
            { volume: 10, num_chapters: 4, chapter_start: 39, chapter_end: 42 },
            { volume: 11, num_chapters: 3, chapter_start: 43, chapter_end: 45 },
            { volume: 12, num_chapters: 5, chapter_start: 46, chapter_end: 50 }
        ];
        volume_data = volume_data.filter(function(d) { return d.volume <= num_volume; });
        //指出开始和结束的角度
        volume_data.forEach(function (d, i) {
            d.startAngle = chapter_location_data[d.chapter_start - 1].startAngle,
                d.endAngle = chapter_location_data[d.chapter_end - 1].endAngle;
            d.centerAngle = (d.endAngle - d.startAngle) / 2 + d.startAngle;
        });

        var volume_slice = donut_volume_group.selectAll(".volume-arc")
            .data(volume_data)
            .enter().append("path")
            .attr("class", "volume-arc")
            .style("stroke", "#c4c4c4")
            .style("stroke", function(d,i) { return d.volume <= 6 ? color_kero : color_sakura; })
            .style("stroke-width", 3 * size_factor)
            .style("stroke-dasharray", "0," + (7 * size_factor))
            .attr("d", function(d,i) {
                var rad = rad_volume_inner,
                    xs = rad * Math.cos(d.startAngle - pi1_2),
                    ys = rad * Math.sin(d.startAngle - pi1_2),
                    xt = rad * Math.cos(d.endAngle - pi1_2),
                    yt = rad * Math.sin(d.endAngle - pi1_2)
                return "M" + xs + "," + ys + " A" + rad + "," + rad + " 0 0 1 " + xt + "," + yt;
            });

        ///////////////////////////////////////////////////////////////////////////
        /////////////////////创建隐藏章节悬停区域 /////////////////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        var arc_chapter_hover = d3.arc()
            .outerRadius(rad_chapter_outer)
            .innerRadius(rad_chapter_inner);

        //每章创建甜甜圈片
        var chapter_hover_group = chart.append("g").attr("class", "chapter-hover-group");
        var chapter_hover = chapter_hover_group.selectAll(".chapter-hover-arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "chapter-hover-arc")
            .attr("d", arc_chapter_hover)
            .style("fill", "none")
            .style("pointer-events", "all")
            .on("mouseover", mouse_over_chapter)
            .on("mouseout", mouse_out);

        //当鼠标在章节弧线上
        function mouse_over_chapter(d,i) {
            d3.event.stopPropagation();
            mouse_over_in_action = true;

            ctx.clearRect(-width / 2, -height / 2, width, height);
            ctx.lineWidth = 4 * size_factor;
            ctx.globalAlpha = 1;
            create_lines("chapter", character_data.filter(function (c) { return c.chapter === i+1; }));

            // //更新 label path
            // line_label_path.attr("d", label_arc(d.centerAngle));
            // //更新  label 文本
            // clearTimeout(remove_text_timer);
            // line_label.text("characters that appear in chapter " + (i+1) );

            //突出显示本章中出现的人物
            var char_chapters = character_data
                .filter(function(c) { return c.chapter === i+1; })
                .map(function(c) { return c.character; });

            names.filter(function(c) { return char_chapters.indexOf(c.character) < 0; })
                .style("opacity", 0.2);
            name_dot.filter(function(c) { return char_chapters.indexOf(c.character) < 0; })
                .style("opacity", 0.2);

            //突出显示章节甜甜圈切片
            chapter_hover_slice.filter(function (c, j) { return i === j; })
                .style("fill", color_sakura)
                .style("stroke", color_sakura);
            chapter_number.filter(function (c, j) { return i === j; })
                .style("fill", "white");
            chapter_dot.filter(function (c, j) { return i === j; })
                .attr("r", chapter_dot_rad * 1.5)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", color_sakura);

            //在中心显示封面图像
            cover_image.attr("xlink:href", "../img/ccs-chapter-" + (i+1) + ".jpg")
            cover_circle.style("fill", "url(#cover-image)");
        }//function mouse_over_chapter




        /////////////////////////////////////////////////////////////////////////
        ///////////////////////// 数据准备 //////////////////////////
        /////////////////////////////////////////////////////////////////////////

        // color_data=color_data.filter(function (d){return d.character<=num_chapters;})

        color_data.forEach(function(d){
            d.cluster =d.chapter -1;
            d.radius=radius_scale(d.percentage);

            //此数据点的重心
            d.focusX=rad_color*Math.cos(chapter_location_data[d.cluster].centerAngle-pi1_2);
            d.focusY=rad_color*Math.sin(chapter_location_data[d.cluster].centerAngle-pi1_2);
            //添加一点随机性，以免在模拟中出现奇怪的放置行为
            d.x=d.focusX+random();
            d.y=d.focusY+random();
        })//forEach

        ///////////////////////////////////////////////////////////////////////////
        /////////////////////////// Create color circles //////////////////////////
        ///////////////////////////////////////////////////////////////////////////
        //The colored circles right after the character names
        var color_group = chart.append("g").attr("class", "color-group");
        var color_circle = color_group.selectAll(".color-circle")
            .data(color_data)
            .enter().append("circle")
            .attr("class", "color-circle")
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; })
            .attr("r", function (d) { return d.radius * size_factor; })
            .style("fill", function (d) { return d.color; })
            .style("stroke", function (d) { return d.color; })
            .style("stroke-width", 3 * size_factor)
        // .call(d3.drag()
        //     .on('start', dragstarted)
        //     .on('drag', dragged)
        //     .on('end', dragended)
        // );
        /////////////////////////////////////////////////////////////////////////
        ///////////////////////// 运行力模拟 //////////////////////////
        /////////////////////////////////////////////////////////////////////////

        simulation = d3.forceSimulation(color_data) //d3.forceSimulation？
            .force("x", d3.forceX().x(function (d) { return d.focusX; }).strength(0.05))
            .force("y", d3.forceY().y(function (d) { return d.focusY; }).strength(0.05))
            .force("collide", d3.forceCollide(function (d) { return (d.radius * 1 + 2.5) * size_factor; }).strength(0))
            .on("tick", tick)
            .on("end", simulation_end)
            .alphaMin(.2)
        //.stop();
        //提高碰撞强度以提供平滑过渡
        var t = d3.timer(function (elapsed) {
            var dt = elapsed / 3000;
            simulation.force("collide").strength(Math.pow(dt, 2) * 0.7);
            if (dt >= 1.0) t.stop();
        });
        function tick(e) {
            color_circle
                .attr("cx", function (d) { return d.x; })
                .attr("cy", function (d) { return d.y; })
        }//function tick
        //simulation结束的时候运行这个函数
        function simulation_end() {
            //Create the CMYK halftones
            color_circle.style("fill", function (d, i) { return "url(#pattern-total-" + i + ")"; })
        }//function simulation_end
        data_save = color_data; //存下最终位置
        //////////////////////////////////////////////////////////////
        ///////////////////// Create CMYK patterns ///////////////////
        //////////////////////////////////////////////////////////////

        //Patterns based on http://blockbuilder.org/veltman/50a350e86de82278ffb2df248499d3e2
        var radius_color_max = 2 * size_factor;
        var radius_color = d3.scaleSqrt().range([0, radius_color_max]);

        var ccs_colors = color_data.map(function (d) { return d.color; }),
            cmyk_colors = ["yellow", "magenta", "cyan", "black"],
            rotation = [0, -15, 15, 45];
        //Loop over the different colors in the palette
        for (var j = 0; j < ccs_colors.length; j++) {
            //Get the radius transformations for this color
            var CMYK = rgbToCMYK(d3.rgb(ccs_colors[j]));

            //Create 4 patterns, C-Y-M-K, together forming the color
            defs.selectAll(".pattern-sub")
                .data(cmyk_colors)
                .enter().append("pattern")
                .attr("id", function (d) { return "pattern-sub-" + d + "-" + j; })
                .attr("patternUnits", "userSpaceOnUse")
                .attr("patternTransform", function (d, i) { return "rotate(" + rotation[i] + ")"; })
                .attr("width", 2 * radius_color_max)
                .attr("height", 2 * radius_color_max)
                .append("circle")
                .attr("fill", Object)
                .attr("cx", radius_color_max)
                .attr("cy", radius_color_max)
                .attr("r", function (d) { return Math.max(0.001, radius_color(CMYK[d])); });

            //Nest the CMYK patterns into a larger pattern
            var patterns = defs.append("pattern")
                .attr("id", "pattern-total-" + j)
                .attr("patternUnits", "userSpaceOnUse")
                .attr("width", radius_color_max * 31)
                .attr("height", radius_color_max * 31)

            //Append white background
            patterns.append("rect")
                .attr("width", width)
                .attr("height", height)
                .attr("x", 0)
                .attr("y", 0)
                .style("fill","white")

            //Add the CMYK patterns
            patterns
                .selectAll(".dots")
                .data(cmyk_colors)
                .enter().append("rect")
                .attr("class", "dots")
                .attr("width", width)
                .attr("height", height)
                .attr("x", 0)
                .attr("y", 0)
                .style("mix-blend-mode", "multiply")
                .attr("fill", function (d, i) { return "url(#pattern-sub-" + cmyk_colors[i] + "-" + j + ")"; })
        }//for j

        ///////////////////////////////////////////////////////////////////////////
        //////////////////////// Create hover color circle ////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        //The stroked circle around the color circles that appears on a hover
        var color_circle_hover_group = chart.append("g").attr("class", "color-circle-hover-group");
        var color_hover_circle = color_circle_hover_group
            // .selectAll(".color-hover-circle")
            // .data(chapter_location_data)
            // .enter()
            .append("circle")
            .attr("class", "color-hover-circle")
            // .attr("cx", function (d) { return rad_color * Math.cos(d.centerAngle - pi1_2); })
            // .attr("cy", function (d) { return rad_color * Math.sin(d.centerAngle - pi1_2); })
            .attr("r",  36 * size_factor)
            .style("fill", "none")
            .style("stroke", color_sakura)
            .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
            .style("opacity", 0);

        ///////////////////////////////////////////////////////////////////////////
        ////////////////////// Create hidden cover hover areas ////////////////////
        ///////////////////////////////////////////////////////////////////////////

        var arc_cover_hover = d3.arc()
            .outerRadius(rad_cover_outer)
            .innerRadius(rad_cover_inner);

        //Create the donut slices per chapter
        var cover_hover_group = chart.append("g").attr("class", "cover-hover-group");
        var cover_hover = cover_hover_group.selectAll(".cover-hover-arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "cover-hover-arc")
            .attr("d", arc_cover_hover)
            .style("fill", "none")
            .style("pointer-events", "all")
            .on("mouseover", mouse_over_cover)
            .on("mouseout", mouse_out);

        //When you mouse over a chapter arc
        function mouse_over_cover(d,i) {
            d3.event.stopPropagation();
            mouse_over_in_action = true;

            ctx.clearRect(-width / 2, -height / 2, width, height);
            ctx.lineWidth = 4 * size_factor;
            ctx.globalAlpha = 1;
            create_lines("character", cover_data.filter(function (c) { return c.chapter === i+1; }));

            // //Update label path
            // line_label_path.attr("d", label_arc(d.centerAngle));
            // //Update the label text
            // clearTimeout(remove_text_timer);
            // line_label.text("characters that appear on the cover of chapter " + (i+1) );

            //Highlight the characters that appear in this chapter
            var char_chapters = cover_data
                .filter(function(c) { return c.chapter === i+1; })
                .map(function(c) { return c.character; });

            names.filter(function(c) { return char_chapters.indexOf(c.character) < 0; })
                .style("opacity", 0.2);
            name_dot.filter(function(c) { return char_chapters.indexOf(c.character) < 0; })
                .style("opacity", 0.2);

            //Highlight the chapter donut slice
            chapter_hover_slice.filter(function (c, j) { return i === j; })
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("stroke", color_sakura);
            chapter_dot.filter(function (c, j) { return i === j; })
                .attr("r", chapter_dot_rad * 1.5)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", color_sakura);

            //Show the cover image in the center
            cover_image.attr("xlink:href", "../img/ccs-chapter-" + (i+1) + ".jpg")
            cover_circle.style("fill", "url(#cover-image)");

            //Show the circle around the color chapter group
            color_hover_circle
                .attr("cx", rad_color * Math.cos(d.centerAngle - pi1_2))
                .attr("cy", rad_color * Math.sin(d.centerAngle - pi1_2))
                .style("opacity", 1);
        }//function mouse_over_cover


        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// 通用的 mouse out 函数 //////////////////////
        ///////////////////////////////////////////////////////////////////////////

        container.on("mouseout", mouse_out);

        //When you mouse out of a chapter or character
        function mouse_out() {
            //只有当之前有鼠标移入之后的移出时，才会运行此功能
            if(!mouse_over_in_action) return;
            mouse_over_in_action = false;

            ctx.clearRect(-width / 2, -height / 2, width, height);
            ctx.globalAlpha = cover_alpha;
            create_lines("character", cover_data);

            // //Update the label text
            // line_label.text(default_label_text)
            // remove_text_timer = setTimeout(function() { line_label.text("")}, 6000);

            //人物名称恢复正常
            names.style("opacity", null);
            name_dot.style("opacity", null);

            //人物名称恢复正常
            names.style("opacity", null);
            name_dot.style("opacity", null);

            //恢复章节标签
            chapter_hover_slice.style("fill", "none").style("stroke", "none");
            chapter_number.style("fill", null);
            chapter_dot
                .attr("r", chapter_dot_rad)
                .style("stroke-width", chapter_dot_rad * 0.5)
                .style("fill", "#c4c4c4");

            //移除封面图像
            cover_circle.style("fill", "none");
            cover_image.attr("xlink:href", "../img/white-square.jpg");

            //隐藏悬停圆圈
            hover_circle.style("opacity", 0);
            //Hide the circle around the color chapter group
            color_hover_circle.style("opacity", 0);

            //还原所有的关系
            relation_lines.style("opacity", 0.7);
            //移除所有的注释
            annotation_relation_group.selectAll(".annotation").remove();
        }//function mouse_out

        ///////////////////////////////////////////////////////////////////////////
        //////////////////////// Create captured card labels //////////////////////
        ///////////////////////////////////////////////////////////////////////////

        var card_group = chart.append("g").attr("class", "card-group");

        //Create a group per character
        var card_label = card_group.selectAll(".card-label")
            .data(chapter_total_data)
            .enter().append("text")
            .attr("class", "card-label")
            .attr("dy", ".35em")
            .each(function(d,i) {
                d.centerAngle = chapter_location_data[d.chapter-1].centerAngle;
            })
            .attr("transform", function (d, i) {
                return "rotate(" + (d.centerAngle * 180 / Math.PI - 90) + ")"
                    + "translate(" + rad_card_label + ")"
                    + (d.centerAngle > 0 & d.centerAngle < Math.PI ? "" : "rotate(180)");
            })
            .style("text-anchor", function (d) { return d.centerAngle > 0 & d.centerAngle < Math.PI ? "start" : "end"; })
            .style("font-size", (10 * size_factor) + "px")
            .text(function (d, i) { return d.card_captured; });
        //////////////////////////////////////////////////////////////
        ///////////////// Create annotation gradients ////////////////
        //////////////////////////////////////////////////////////////

        //Gradient for the titles of the annotations
        var grad = defs.append("linearGradient")
            .attr("id", "gradient-title")
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "100%").attr("y2", "0%");
        grad.append("stop")
            .attr("offset", "50%")
            .attr("stop-color", color_sakura);
        grad.append("stop")
            .attr("offset", "200%")
            .attr("stop-color", "#ED8B6A");

        //Gradient for the titles of the annotations
        var grad = defs.append("linearGradient")
            .attr("id", "gradient-title-legend")
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "100%").attr("y2", "0%");
        grad.append("stop")
            .attr("offset", "50%")
            .attr("stop-color", color_syaoran);
        grad.append("stop")
            .attr("offset", "200%")
            .attr("stop-color", "#9ABF2B");

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////// Create annotations //////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        //Only create annotations when the screen is big enough
        if(!width_too_small) {

            var annotations = [
                {
                    note: {
                        label: "Around the right half of the large circle you can see in which chapter the Clow cards were captured. Sakura was already in possession of Windy and Wood at the start of chapter 1",
                        title: "Clow Cards",
                        wrap: 270*size_factor,
                    },
                    chapter: 1,
                    extra_rad: 24 * size_factor,
                    className: "note-right note-legend",
                    x: 151 * size_factor,
                    y: -705 * size_factor,
                    cx: 55 * size_factor,
                    cy: -686 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "These circles reveal the main colors present in each chapter's cover art. The size of each circle represents the percentage of the cover image that is captured in that color. All circles from one chapter add up to 100%",
                        title: "Cover art",
                        wrap: 270*size_factor,
                    },
                    chapter: 1,
                    extra_rad: 55 * size_factor,
                    className: "note-right note-legend",
                    x: 532 * size_factor,
                    y: -532 * size_factor,
                    cx: 412 * size_factor,
                    cy: -493 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "With the 10 captured cards, Kero teaches Sakura how to do a fortune-telling to get insight into which card is running around town looking like Sakura",
                        title: "Fortune-telling",
                        wrap: 205*size_factor,
                    },
                    chapter: 11,
                    extra_rad: 30 * size_factor,
                    className: "note-right note-story",
                    x: 745 * size_factor,
                    y: -115 * size_factor,
                    cx: 612 * size_factor,
                    cy: -161 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "Sakura, Tomoyo and Syaoran are stuck in a maze, when Kaho appears and breaks the walls with her 'Moon Bell', guiding the group to the exit",
                        title: "Kaho's Bell",
                        wrap: 190*size_factor,
                        padding: 10*size_factor
                    },
                    chapter: 15,
                    extra_rad: 22 * size_factor,
                    className: "note-right note-story",
                    x: 774 * size_factor,
                    y: 240 * size_factor,
                    cx: 657 * size_factor,
                    cy: 170 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "This chapter is mostly Sakura and Syaoran during their school trip at the beach. While on an evening event in a cave everybody else starts to disappear",
                        title: "Ghost stories",
                        wrap: 200*size_factor,
                        padding: 10*size_factor
                    },
                    chapter: 17,
                    extra_rad: 30 * size_factor,
                    className: "note-right note-story",
                    x: 736 * size_factor,
                    y: 407 * size_factor,
                    cx: 607 * size_factor,
                    cy: 323 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "Kero can finally return to his full form after Sakura catches the Firey card",
                        title: "Cerberus",
                        wrap: 180*size_factor,
                        padding: 10*size_factor
                    },
                    chapter: 23,
                    extra_rad: 30 * size_factor,
                    className: "note-right note-story",
                    x: 256 * size_factor,
                    y: 780 * size_factor,
                    cx: 210 * size_factor,
                    cy: 650 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "After the capture of all 19 cards, Yue holds 'the final trial'. Eventually, he accepts Sakura as the new mistress of the Clow Cards",
                        title: "The final judge",
                        wrap: 220*size_factor,
                        padding: 10*size_factor
                    },
                    chapter: 26,
                    extra_rad: 60 * size_factor,
                    className: "note-right note-story",
                    x: -10 * size_factor,
                    y: 812 * size_factor,
                    cx: -26 * size_factor,
                    cy: 634 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "Around the left half of the large circle you can see in which chapter the Clow cards were converted to Sakura cards",
                        title: "Sakura Cards",
                        wrap: 200*size_factor,
                        padding: 10*size_factor
                    },
                    chapter: 29,
                    extra_rad: 25 * size_factor,
                    className: "note-left note-legend",
                    x: -291 * size_factor,
                    y: 764 * size_factor,
                    cx: -287 * size_factor,
                    cy: 624 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "Syaoran finally understands that it's Sakura that he loves, not Yukito",
                        title: "First love",
                        wrap: 170*size_factor,
                        padding: 10*size_factor
                    },
                    chapter: 31,
                    extra_rad: 92 * size_factor,
                    className: "note-left note-story",
                    x: -460 * size_factor,
                    y: 655 * size_factor,
                    cx: -406 * size_factor,
                    cy: 485 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "The Fly transforms to give Sakura herself wings to fly, instead of her staff",
                        title: "Fly",
                        wrap: 230*size_factor,
                    },
                    chapter: 32,
                    extra_rad: 27 * size_factor,
                    className: "note-left note-story",
                    x: -598 * size_factor,
                    y: 556 * size_factor,
                    cx: -515 * size_factor,
                    cy: 485 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "Toya gives his magical powers to Yue (and thus also Yukito) to keep them from disappearing because Sakura doesn't yet have enough magic herself to sustain them",
                        title: "Toya's gift",
                        wrap: 180*size_factor,
                        padding: 10*size_factor
                    },
                    chapter: 38,
                    extra_rad: 50 * size_factor,
                    className: "note-left note-story",
                    x: -785 * size_factor,
                    y: 148 * size_factor,
                    cx: -700 * size_factor,
                    cy: 12 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "Sakura and Syaoran use their magic together to defeat Eriol's bronze horse",
                        title: "Teamwork",
                        wrap: 200*size_factor,
                    },
                    chapter: 42,
                    extra_rad: 30 * size_factor,
                    className: "note-left note-story",
                    x: -735 * size_factor,
                    y: -366 * size_factor,
                    cx: -695 * size_factor,
                    cy: -370 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "Sakura 'defeats' Eriol and has now transformed all the Clow cards into Sakura cards",
                        title: "The strongest magician",
                        wrap: 270*size_factor,
                    },
                    chapter: 44,
                    extra_rad: 30 * size_factor,
                    className: "note-left note-story",
                    x: -596 * size_factor,
                    y: -577 * size_factor,
                    cx: -593 * size_factor,
                    cy: -560 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                },{
                    note: {
                        label: "Sakura realizes she loves Syaoran the most, right before he leaves for the airport to move back home to Hong Kong",
                        title: "True love",
                        wrap: 240*size_factor,
                    },
                    chapter: 50,
                    extra_rad: 30 * size_factor,
                    className: "note-left note-story",
                    x: -125 * size_factor,
                    y: -660 * size_factor,
                    cx: -48 * size_factor,
                    cy: -633 * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                }
            ];

            //Set-up the annotation maker
            var makeAnnotations = d3.annotation()
                //.editMode(true)
                .type(d3.annotationLabel)
                .annotations(annotations);

            //Call and create the textual part of the annotations
            var annotation_group = chart.append("g").attr("class", "annotation-group");
            annotation_group.call(makeAnnotations);

            //Update a few stylings
            annotation_group.selectAll(".note-line, .connector")
                .style("stroke", "none");
            annotation_group.selectAll(".annotation-note-title")
                .style("fill", "url(#gradient-title)");

            //Create my own radially pointing connector lines
            var annotation_connector_group = annotation_group.append("g", "annotation-connectors");
            annotations.forEach(function(d,i) {
                var angle = Math.atan(d.cy/d.cx);
                if(d.cx < 0) angle = -Math.atan(d.cy/-d.cx) + Math.PI;
                annotation_connector_group.append("line")
                    .attr("class", "connector-manual " + d.className)
                    .attr("x1", d.cx)
                    .attr("y1", d.cy)
                    .attr("x2", d.cx + d.extra_rad * Math.cos(angle) )
                    .attr("y2", d.cy + d.extra_rad * Math.sin(angle) )
                    .style("stroke-width", 2 * size_factor)
                    .style("stroke-linecap", "round")
                    .style("stroke", color_sakura);
            });

            //Turn the legend based annotations green
            annotation_group.selectAll(".note-legend .annotation-note-title")
                .style("fill", "url(#gradient-title-legend)");
            annotation_connector_group.selectAll(".note-legend")
                .style("stroke", color_syaoran);

            //Add circles to the legend annotations
            var annotation_circle_group = annotation_group.append("g", "annotation-circles");
            //Add circle to first clow card
            annotation_circle_group.append("circle")
                .attr("class", "annotation-circle")
                .attr("cx", 50 * size_factor)
                .attr("cy", -655 * size_factor)
                .attr("r", 25 * size_factor);

            //Add circle to cover art annotation
            annotation_circle_group.append("circle")
                .attr("class", "annotation-circle")
                .attr("cx", rad_color * Math.cos(chapter_location_data[5].centerAngle - pi1_2))
                .attr("cy", rad_color * Math.sin(chapter_location_data[5].centerAngle - pi1_2))
                .attr("r", 38 * size_factor);

            //Add circle to first sakura card
            annotation_circle_group.append("circle")
                .attr("class", "annotation-circle")
                .attr("cx", -273 * size_factor)
                .attr("cy", 596 * size_factor)
                .attr("r", 25 * size_factor);

            annotation_circle_group.selectAll(".annotation-circle")
                .style("stroke-dasharray", "0," + (6 * size_factor))
                .style("stroke-width", 2.5 * size_factor)
                .style("stroke", color_syaoran);

            //Make it possible to show/hide the annotations
            var show_annotations = true;
            d3.select("#story-annotation")
                .style("opacity", 1)
                .on("click", spoiler_click);

            function spoiler_click() {
                show_annotations = !show_annotations;
                annotation_group.selectAll(".note-story")
                    .style("opacity", show_annotations ? 1 : 0);
                d3.select("#hide-show").html(show_annotations ? "hide" : "show");
            }//function spoiler_click

        } else {
            //Hide the annotation mentions in the intro
            d3.select("#annotation-explanation").style("display","none");
        }//else

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// Create line title label /////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        var line_label_group = chart.append("g").attr("class", "line-label-group");

        //Define the arc on which to draw the label text
        function label_arc(angle) {
            var x1 = rad_line_label * Math.cos(angle + 0.01 - pi1_2),
                y1 = rad_line_label * Math.sin(angle + 0.01 - pi1_2);
            var x2 = rad_line_label * Math.cos(angle - 0.01 - pi1_2),
                y2 = rad_line_label * Math.sin(angle - 0.01 - pi1_2);
            if (angle / Math.PI > 0.5 && angle / Math.PI < 1.5) {
                return "M" + x1 + "," + y1 + " A" + rad_line_label + "," + rad_line_label + " 0 1 1 " + x2 + "," + y2;
            } else {
                return "M" + x2 + "," + y2 + " A" + rad_line_label + "," + rad_line_label + " 0 1 0 " + x1 + "," + y1;
            }//else
        }//function label_arc

        //Create the paths along which the pillar labels will run
        var line_label_path = line_label_group.append("path")
            .attr("class", "line-label-path")
            .attr("id", "line-label-path")
            .attr("d", label_arc(characterByName["Sakura"].name_angle))
            .style("fill", "none")
            .style("display", "none");

        //Create the label text
        var default_label_text = "currently, these lines show which characters appear on the chapter's cover art";
        var line_label = line_label_group.append("text")
            .attr("class", "line-label")
            .attr("dy", "0.35em")
            .style("text-anchor", "middle")
            .style("font-size", (14 * size_factor) + "px")
            .append("textPath")
            .attr("xlink:href", "#line-label-path")
            .attr("startOffset", "50%")
            .text(default_label_text);

        ///////////////////////////////////////////////////////////////////////////
        //////////////////// 创建人物和章节之间的关系线 /////////////////////
        ///////////////////////////////////////////////////////////////////////////

        //线函数，使用canvas将线条从人物连接到章节
        var line = d3.lineRadial()
            .angle(function(d) { return d.angle; })
            .radius(function(d) { return d.radius; })
            .curve(d3.curveBasis)
            .context(ctx);

        //为封面绘制线条
        ctx.globalAlpha = cover_alpha;
        create_lines("character", cover_data);

        function create_lines(type, data) {

            for (var i = 0; i < data.length; i++) {
                d = data[i];
                var line_data = [];

                var source_a = characterByName[d.character].name_angle,
                    source_r = characterByName[d.character].dot_name_rad
                var target_a = chapter_location_data[d.chapter - 1].centerAngle,
                    target_r = rad_dot_color;

                //找出一些变量来决定要创建的路径
                if (target_a - source_a < -Math.PI) {
                    var side = "cw";
                    var da = 2 + (target_a - source_a) / Math.PI;
                    var angle_sign = 1;
                } else if (target_a - source_a < 0) {
                    var side = "ccw";
                    var da = (source_a - target_a) / Math.PI;
                    var angle_sign = -1;
                } else if (target_a - source_a < Math.PI) {
                    var side = "cw";
                    var da = (target_a - source_a) / Math.PI;
                    var angle_sign = 1;
                } else {
                    var side = "ccw";
                    var da = 2 - (target_a - source_a) / Math.PI;
                    var angle_sign = -1;
                }//else
                //console.log(side, da, angle_sign);


                //计算线路中间弧形部分的半径
                var range = type === "character" ? [rad_line_max, rad_line_min] : [rad_line_min, rad_line_max];
                var scale_rad_curve = d3.scaleLinear()
                    .domain([0, 1])
                    .range(range);
                var rad_curve_line = scale_rad_curve(da) * width;

                //对曲线上的第一点上进行稍微的偏移
                var range = type === "character" ? [0, 0.07] : [0, 0.01];
                var scale_angle_start_offset = d3.scaleLinear()
                    .domain([0, 1])
                    .range(range);
                var start_angle = source_a + angle_sign * scale_angle_start_offset(da) * Math.PI;

                //对曲线上的最后一个点进行稍微的偏移
                var range = type === "character" ? [0, 0.02] : [0, 0.07];
                var scale_angle_end_offset = d3.scaleLinear()
                    .domain([0, 1])
                    .range(range);
                var end_angle = target_a - angle_sign * scale_angle_end_offset(da) * Math.PI;

                if (target_a - source_a < -Math.PI) {
                    var da_inner = pi2 + (end_angle - start_angle);
                } else if (target_a - source_a < 0) {
                    var da_inner = (start_angle - end_angle);
                } else if (target_a - source_a < Math.PI) {
                    var da_inner = (end_angle - start_angle);
                } else if (target_a - source_a < 2 * Math.PI) {
                    var da_inner = pi2 - (end_angle - start_angle)
                }//else if

                //将第一个点连接到数据
                line_data.push({
                    angle: source_a,
                    radius: source_r
                });

                //附加曲线部分的第一点
                line_data.push({
                    angle: start_angle,
                    radius: rad_curve_line
                });

                //为曲线线在中间创建点
                var step = 0.06;
                var n = Math.abs(Math.floor(da_inner / step));
                var curve_angle = start_angle;
                var sign = side === "cw" ? 1 : -1;
                if(n >= 1) {
                    for (var j = 0; j < n; j++) {
                        curve_angle += (sign * step) % pi2;
                        line_data.push({
                            angle: curve_angle,
                            radius: rad_curve_line
                        });
                    }//for j
                }//if

                //附加曲线部分的最后一个点
                line_data.push({
                    angle: end_angle,
                    radius: rad_curve_line
                });

                //将最后一个点连接到数据
                line_data.push({
                    angle: target_a,
                    radius: target_r
                });

                //画路径
                ctx.beginPath();
                line(line_data);
                ctx.strokeStyle = characterByName[d.character].color;
                ctx.stroke();

            }//for

            ctx.globalAlpha = 0.7;
            ctx.lineWidth = 3 * size_factor;

        }//function create_lines




    }//function draw

    //非模糊的canvas
    function crispyCanvas(canvas,ctx,sf){
        canvas
            .attr("width",sf * width )
            .attr("height",sf * height)
            .style("width",width+"px")
            .style("height",height +"px");
        ctx.scale(sf,sf);
    }//function crispyCanvas

    }//function create_CCS_chart

//////////////////////////////////////////////////////////////
////////////////////// 帮助函数  //////////////////////
//////////////////////////////////////////////////////////////

// RGB 到 CMYK颜色转换 "circle radii"
function rgbToCMYK(rgb) {
    var r = rgb.r / 255,
        g = rgb.g / 255,
        b = rgb.b / 255,
        k = 1 - Math.max(r, g, b);

    return {
        cyan: (1 - r - k) / (1 - k),
        magenta: (1 - g - k) / (1 - k),
        yellow: (1 - b - k) / (1 - k),
        black: k
    };
}//function rgbToCMYK
//生成随机数
var seed = 4;
function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}//function random
//首字母大写函数
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}//function capitalizeFirstLetter