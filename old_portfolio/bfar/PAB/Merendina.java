public class Merendina extends Prodotto {
    
    private int calorie;
    
    public Merendina(int costo, String nome, int calorie){
        super(costo,nome);
        this.calorie=calorie;
    }
    
    public int getCosto(){
        return costo;
    }
}