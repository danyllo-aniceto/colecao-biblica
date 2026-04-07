package backend.repository;

import backend.model.ShopItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ShopItemRepository extends JpaRepository<ShopItem, Long> {
    List<ShopItem> findByActiveTrueOrderByPriceCoinsAsc();
}
