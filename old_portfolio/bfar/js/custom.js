function xmlDates(){
    
      $(document).ready(function() {
	$(".fancybox").fancybox({
		openEffect	: 'none',
		closeEffect	: 'none'
	});
});
    
    
    var i;
     xmlhttp= new XMLHttpRequest();
    xmlhttp.open("GET", "../css/xml/Dates.xml",false);
    xmlhttp.send();
    xmlDoc=xmlhttp.responseXML;
    var concerts = xmlDoc.getElementsByTagName('date');
    
    if(concerts.nodeValue==undefined){
        document.getElementById('concerts').innerHTML = '<div class="col-md-12"><span class="place">Nessuna data in vista, stay tuned!</span></div>'
    }
    
    else{
    
    for(i=0;i<concerts.length;i++){
        
        document.getElementById('concerts').innerHTML += '<div class="row"><div class="col-md-2"><div class="text-center"><span class="month" name="month">'+xmlDoc.getElementsByTagName('month')[i].childNodes[0].nodeValue+'</span><br><span class="day" name="day">'+xmlDoc.getElementsByTagName('day')[i].childNodes[0].nodeValue+'</span><br><span class="year" name="year">'+xmlDoc.getElementsByTagName('year')[i].childNodes[0].nodeValue+'</span></div></div><div class="col-md-10 text-center"><span style="color:rgba(50,50,50,1)"></span><br><br><span class="place">'+xmlDoc.getElementsByTagName('place')[i].childNodes[0].nodeValue+'</span></div></div>';
        
        if(i!=concerts.length){
            document.getElementById('concerts').innerHTML += '<hr class="featurette-divider-dates">';
        }
    }

    }
}

function changstatus(num){
    
    var i;
    
    for(i=0;i<document.getElementsByName('nav').length; i++){
    document.getElementsByName('nav')[i].className = "";
    }

    document.getElementsByName('nav')[num].className = "active";
    
}