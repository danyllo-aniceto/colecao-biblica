package backend.controller;

import backend.dto.CreateShopItemRequest;
import backend.dto.ShopItemResponse;
import backend.dto.UpdateShopItemRequest;
import backend.service.ShopService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/shop")
public class ShopController {

    private final ShopService service;

    public ShopController(ShopService service) {
        this.service = service;
    }

    @GetMapping
    public List<ShopItemResponse> listItems() {
        return service.listActiveItems();
    }

    @PostMapping("/admin")
    public ShopItemResponse create(@Valid @RequestBody CreateShopItemRequest request) {
        return service.create(request);
    }

    @PutMapping("/admin/{id}")
    public ShopItemResponse update(@PathVariable Long id, @Valid @RequestBody UpdateShopItemRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/admin/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    @PostMapping("/buy/{shopItemId}")
    public ShopItemResponse buy(@PathVariable Long shopItemId) {
        return service.buy(shopItemId);
    }
}
