let deferredInstallPrompt=null;
const installBox=document.getElementById("installBox");
const installApp=document.getElementById("installApp");

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}

window.addEventListener("beforeinstallprompt",(event)=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  installBox.classList.remove("hidden");
});

installApp.addEventListener("click",async()=>{
  if(!deferredInstallPrompt){
    alert("No celular, abra o menu do navegador e toque em Adicionar à tela inicial.");
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  installBox.classList.add("hidden");
});

const weatherCodes={
  0:["☀️","Céu limpo"],1:["🌤️","Poucas nuvens"],2:["⛅","Parcialmente nublado"],3:["☁️","Nublado"],
  45:["🌫️","Neblina"],51:["🌦️","Garoa fraca"],53:["🌦️","Garoa"],55:["🌧️","Garoa forte"],
  61:["🌧️","Chuva fraca"],63:["🌧️","Chuva"],65:["⛈️","Chuva forte"],
  80:["🌦️","Pancadas fracas"],81:["🌧️","Pancadas"],82:["⛈️","Pancadas fortes"],95:["⛈️","Tempestade"]
};

const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
let activeTimezone=Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
let activePlace="São Paulo";

function codeInfo(code){return weatherCodes[code] || ["🌡️","Condição não informada"];}

function updateClock(){
  const now=new Date();
  document.getElementById("clock").textContent=new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit",timeZone:activeTimezone}).format(now);
  document.getElementById("clockDate").textContent=new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric",timeZone:activeTimezone}).format(now);
  document.getElementById("clockCity").textContent=`Horário em ${activePlace} · ${activeTimezone}`;
}
setInterval(updateClock,1000);
updateClock();

async function loadWeather(){
  const city=document.getElementById("cityInput").value.trim();
  if(!city)return alert("Digite uma cidade.");

  const placeEl=document.getElementById("weatherPlace");
  const grid=document.getElementById("weatherGrid");
  placeEl.textContent="Buscando...";
  grid.innerHTML="";

  try{
    const geoUrl=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`;
    const geo=await fetch(geoUrl).then(r=>r.json());
    if(!geo.results || !geo.results.length)throw new Error("Cidade não encontrada.");

    const loc=geo.results[0];
    activeTimezone=loc.timezone || "auto";
    activePlace=`${loc.name}${loc.admin1 ? ", "+loc.admin1 : ""}`;
    updateClock();

    const weatherUrl=`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&forecast_days=7&timezone=auto`;
    const data=await fetch(weatherUrl).then(r=>r.json());
    const current=data.current;
    const currentInfo=codeInfo(current.weather_code);

    placeEl.textContent=activePlace;
    document.getElementById("nowTemp").textContent=`${Math.round(current.temperature_2m)}°C`;
    document.getElementById("nowDesc").textContent=`${currentInfo[0]} ${currentInfo[1]}`;
    document.getElementById("weatherDetails").textContent=`Umidade ${current.relative_humidity_2m}% · vento ${Math.round(current.wind_speed_10m)} km/h.`;

    grid.innerHTML=data.daily.time.map((day,index)=>{
      const info=codeInfo(data.daily.weather_code[index]);
      const label=new Intl.DateTimeFormat("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",timeZone:activeTimezone}).format(new Date(day+"T12:00:00"));
      return `<article class="day">
        <strong>${label}</strong>
        <div class="weather-code">${info[0]}</div>
        <div>${info[1]}</div>
        <div class="temp-line">${Math.round(data.daily.temperature_2m_min[index])}° / ${Math.round(data.daily.temperature_2m_max[index])}°C</div>
        <small>Chuva ${data.daily.precipitation_probability_max[index] ?? 0}% · vento ${Math.round(data.daily.wind_speed_10m_max[index] || 0)} km/h</small>
      </article>`;
    }).join("");
  }catch(error){
    placeEl.textContent="Erro ao buscar previsão";
    document.getElementById("nowTemp").textContent="--°";
    document.getElementById("nowDesc").textContent=error.message;
  }
}

function stockScore(stock){
  const change=Number(stock.regularMarketChangePercent || 0);
  const high=Number(stock.regularMarketDayHigh || stock.regularMarketPrice || 0);
  const low=Number(stock.regularMarketDayLow || stock.regularMarketPrice || 0);
  const price=Number(stock.regularMarketPrice || 0);
  const rangePenalty=price>0 ? ((high-low)/price)*20 : 0;
  return Math.round((50 + change*8 - rangePenalty)*10)/10;
}

async function loadStocks(){
  const symbols=document.getElementById("stockInput").value.replace(/\s/g,"").toUpperCase();
  if(!symbols)return alert("Digite pelo menos um código de ação.");

  const grid=document.getElementById("stockGrid");
  const best=document.getElementById("bestStock");
  grid.innerHTML="";
  best.textContent="Carregando cotações...";

  try{
    const url=`https://brapi.dev/api/v2/stocks/quote?symbols=${encodeURIComponent(symbols)}`;
    const data=await fetch(url).then(r=>r.json());
    const stocks=data.results || [];
    if(!stocks.length)throw new Error("Nenhuma cotação encontrada.");

    const ranked=stocks.map(stock=>({...stock,score:stockScore(stock)})).sort((a,b)=>b.score-a.score);
    const top=ranked[0];
    best.textContent=`Maior pontuação educativa hoje: ${top.symbol} (${top.score} pontos). Isso não é recomendação de compra.`;

    grid.innerHTML=ranked.map(stock=>{
      const change=Number(stock.regularMarketChangePercent || 0);
      const cls=change>=0 ? "up" : "down";
      const isBest=stock.symbol===top.symbol ? "best" : "";
      return `<article class="stock ${isBest}">
        <div class="ticker">${stock.symbol}</div>
        <div class="muted">${stock.shortName || stock.longName || "Ativo B3"}</div>
        <div class="price">${money.format(Number(stock.regularMarketPrice || 0))}</div>
        <div class="${cls}">${change.toFixed(2)}%</div>
        <p class="small">Máx: ${money.format(Number(stock.regularMarketDayHigh || 0))} · Mín: ${money.format(Number(stock.regularMarketDayLow || 0))}</p>
        <span class="score">Pontuação ${stock.score}</span>
      </article>`;
    }).join("");
  }catch(error){
    best.textContent=error.message;
  }
}

const storageKey="tempoBolsaEconomia.savings.v1";
let savings=JSON.parse(localStorage.getItem(storageKey) || "[]");

function saveSavings(){localStorage.setItem(storageKey,JSON.stringify(savings));}

function renderSavings(){
  const rows=document.getElementById("savingsRows");
  const total=savings.reduce((sum,item)=>sum+item.amount,0);
  const goal=Number(document.getElementById("saveGoal").value || localStorage.getItem(storageKey+".goal") || 0);
  const avg=savings.length ? total/savings.length : 0;
  const progress=goal>0 ? Math.min(100,(total/goal)*100) : 0;

  document.getElementById("totalSaved").textContent=money.format(total);
  document.getElementById("goalValue").textContent=money.format(goal);
  document.getElementById("goalProgress").textContent=`${progress.toFixed(1)}%`;
  document.getElementById("avgSaved").textContent=money.format(avg);

  rows.innerHTML=savings.length ? savings.map((item,index)=>`<tr>
    <td>${item.date}</td>
    <td>${item.desc}</td>
    <td class="money">${money.format(item.amount)}</td>
    <td><button class="btn btn-light" type="button" onclick="removeSaving(${index})">Remover</button></td>
  </tr>`).join("") : `<tr><td colspan="4" class="muted">Nenhum valor cadastrado ainda.</td></tr>`;
}

function addSaving(){
  const date=document.getElementById("saveDate").value;
  const desc=document.getElementById("saveDesc").value.trim() || "Dinheiro guardado";
  const amount=Number(document.getElementById("saveAmount").value || 0);
  const goal=Number(document.getElementById("saveGoal").value || 0);
  if(!date)return alert("Escolha o mês.");
  if(amount<=0)return alert("Digite um valor maior que zero.");

  if(goal>0)localStorage.setItem(storageKey+".goal",String(goal));
  savings.push({date,desc,amount});
  savings.sort((a,b)=>a.date.localeCompare(b.date));
  saveSavings();
  document.getElementById("saveAmount").value="";
  document.getElementById("saveDesc").value="";
  renderSavings();
}

window.removeSaving=function(index){
  savings.splice(index,1);
  saveSavings();
  renderSavings();
};

function exportCsv(){
  const header="mes,descricao,valor\n";
  const body=savings.map(item=>`${item.date},"${item.desc.replaceAll('"','""')}",${item.amount}`).join("\n");
  const blob=new Blob([header+body],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="dinheiro-guardado.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function clearSavings(){
  if(!confirm("Tem certeza que quer apagar a planilha?"))return;
  savings=[];
  saveSavings();
  renderSavings();
}

document.getElementById("weatherBtn").addEventListener("click",loadWeather);
document.getElementById("stockBtn").addEventListener("click",loadStocks);
document.getElementById("addSave").addEventListener("click",addSaving);
document.getElementById("exportCsv").addEventListener("click",exportCsv);
document.getElementById("clearSavings").addEventListener("click",clearSavings);
document.getElementById("saveGoal").addEventListener("input",()=>{
  localStorage.setItem(storageKey+".goal",document.getElementById("saveGoal").value || "0");
  renderSavings();
});

const now=new Date();
document.getElementById("saveDate").value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
document.getElementById("saveGoal").value=localStorage.getItem(storageKey+".goal") || "";
renderSavings();
loadWeather();
loadStocks();