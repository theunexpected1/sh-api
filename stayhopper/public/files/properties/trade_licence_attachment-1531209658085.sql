-- phpMyAdmin SQL Dump
-- version 4.6.6
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jul 10, 2018 at 05:16 AM
-- Server version: 5.6.26-74.0-log
-- PHP Version: 5.6.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `iroidulq_britespan`
--

-- --------------------------------------------------------

--
-- Table structure for table `series_widths`
--

CREATE TABLE `series_widths` (
  `id` int(11) NOT NULL,
  `series` varchar(15) NOT NULL,
  `model` varchar(5) NOT NULL,
  `width_feet` int(11) NOT NULL,
  `width_metres` decimal(4,1) NOT NULL,
  `mount_type` varchar(15) DEFAULT NULL,
  `height_feet` int(11) DEFAULT NULL,
  `truss_model` varchar(3) DEFAULT NULL,
  `deadloadbayincrementpercent` decimal(5,3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `series_widths`
--

INSERT INTO `series_widths` (`id`, `series`, `model`, `width_feet`, `width_metres`, `mount_type`, `height_feet`, `truss_model`, `deadloadbayincrementpercent`) VALUES
(1, 'Atlas', '19', 19, '5.8', 'Post Mount', NULL, 'A18', NULL),
(2, 'Atlas', '24', 24, '7.3', 'Post Mount', NULL, 'A18', NULL),
(3, 'Atlas', '30', 30, '9.1', 'Post Mount', NULL, 'A18', NULL),
(4, 'Atlas', '32', 32, '9.8', 'Post Mount', NULL, 'A18', NULL),
(5, 'Atlas', '36', 36, '11.0', 'Post Mount', NULL, 'A18', NULL),
(6, 'Atlas', '40', 40, '12.2', 'Post Mount', NULL, 'A18', NULL),
(7, 'Atlas', '41L6', 40, '12.2', 'Steel Leg Mount', NULL, 'A18', NULL),
(8, 'Atlas', '41L8', 40, '12.2', 'Steel Leg Mount', NULL, 'A18', NULL),
(9, 'Atlas', '42', 42, '12.8', 'Post Mount', NULL, 'A18', NULL),
(10, 'Atlas', '46', 46, '14.0', 'Post Mount', NULL, 'A18', NULL),
(11, 'Atlas', '52L6', 52, '15.8', 'Steel Leg Mount', NULL, 'A18', NULL),
(12, 'Atlas', '52L8', 52, '15.8', 'Steel Leg Mount', NULL, 'A18', NULL),
(13, 'Atlas', '62', 62, '18.9', 'Post Mount', NULL, 'A18', NULL),
(15, 'Atlas', '70', 70, '21.3', 'Post Mount', NULL, 'A24', NULL),
(18, 'Apex', '53', 53, '16.2', 'Steel Leg Mount', NULL, NULL, NULL),
(19, 'Apex', '60', 60, '18.3', 'Steel Leg Mount', NULL, NULL, NULL),
(20, 'Apex', '80', 80, '24.4', 'Steel Leg Mount', NULL, NULL, NULL),
(21, 'Apex', '100', 100, '30.5', 'Steel Leg Mount', NULL, NULL, NULL),
(22, 'Easy Access', '38', 38, '11.6', 'Steel Leg Mount', NULL, NULL, NULL),
(23, 'Easy Access', '46', 46, '14.0', 'Steel Leg Mount', NULL, NULL, NULL),
(24, 'Easy Access', '60', 60, '18.3', 'Steel Leg Mount', NULL, NULL, NULL),
(25, 'Easy Access', '67', 67, '20.4', 'Steel Leg Mount', NULL, NULL, NULL),
(26, 'Accent', '26', 26, '7.9', 'Ground Mount', NULL, NULL, NULL),
(27, 'Accent', '28', 28, '8.5', 'Ground Mount', NULL, NULL, NULL),
(28, 'Rapid Structure', '20', 20, '6.1', 'Ground Mount', NULL, NULL, NULL),
(29, 'Rapid Structure', '26', 26, '7.9', 'Ground Mount', NULL, NULL, NULL),
(30, 'Rapid Structure', '30', 30, '9.1', 'Ground Mount', NULL, NULL, NULL),
(31, 'Genesis 3', '50', 50, '15.2', 'Steel Leg Mount', NULL, 'G', NULL),
(32, 'Genesis 3', '60', 60, '18.3', 'Steel Leg Mount', NULL, 'G', NULL),
(33, 'Genesis 3', '70', 70, '21.3', 'Steel Leg Mount', NULL, 'G', NULL),
(34, 'Genesis 3', '80', 80, '24.4', 'Steel Leg Mount', NULL, 'G', NULL),
(35, 'Genesis 3', '100', 100, '30.5', 'Steel Leg Mount', NULL, 'G', NULL),
(36, 'Genesis 4', '100', 100, '30.5', 'Steel Leg Mount', NULL, 'G', NULL),
(37, 'Genesis 4', '110', 110, '33.5', 'Steel Leg Mount', NULL, 'G', NULL),
(38, 'Genesis 4', '120', 120, '36.6', 'Steel Leg Mount', NULL, 'G', NULL),
(39, 'Genesis 4', '130', 130, '39.6', 'Steel Leg Mount', NULL, 'G', NULL),
(40, 'Genesis 4', '140', 140, '42.7', 'Steel Leg Mount', NULL, 'G', NULL),
(41, 'Genesis 5', '140', 140, '42.7', 'Steel Leg Mount', NULL, 'G', NULL),
(42, 'Genesis 5', '150', 150, '45.7', 'Steel Leg Mount', NULL, 'G', NULL),
(43, 'Genesis 5', '160', 160, '48.8', 'Steel Leg Mount', NULL, 'G', NULL),
(44, 'Atlas', '50', 50, '15.2', 'Post Mount', NULL, 'A18', NULL),
(45, 'Atlas', '55', 55, '16.8', 'Post Mount', NULL, 'A18', NULL),
(46, 'Atlas', '82', 82, '25.0', 'Ground Mount', NULL, 'A24', NULL),
(47, 'Atlas', '24', 24, '7.3', 'Ground Mount', NULL, 'A18', NULL),
(48, 'Atlas', '30', 30, '9.1', 'Ground Mount', NULL, 'A18', NULL),
(49, 'Atlas', '36', 36, '11.0', 'Ground Mount', NULL, 'A18', NULL),
(50, 'Atlas', '40', 40, '12.2', 'Ground Mount', NULL, 'A18', NULL),
(51, 'Atlas', '50', 50, '15.2', 'Ground Mount', NULL, 'A18', NULL),
(52, 'Atlas', '32', 32, '9.8', 'Ground Mount', NULL, 'A18', NULL),
(53, 'Atlas', '42', 42, '12.8', 'Ground Mount', NULL, 'A18', NULL),
(54, 'Atlas', '46', 46, '14.0', 'Ground Mount', NULL, 'A18', NULL),
(55, 'Atlas', '62', 62, '18.9', 'Ground Mount', NULL, 'A18', NULL),
(56, 'Atlas', '65L10', 65, '19.8', 'Steel Leg Mount', NULL, 'A24', NULL),
(57, 'Atlas', '72L10', 72, '21.9', 'Steel Leg Mount', NULL, 'A24', NULL),
(58, 'Atlas', '19', 19, '5.8', 'Ground Mount', NULL, 'A18', NULL),
(59, 'Atlas', '55', 55, '16.8', 'Ground Mount', NULL, 'A18', NULL),
(60, 'Atlas', '70', 70, '21.3', 'Ground Mount', NULL, 'A24', NULL),
(61, 'Atlas', '80L8', 80, '24.4', 'Steel Leg Mount', NULL, 'A24', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `series_widths`
--
ALTER TABLE `series_widths`
  ADD PRIMARY KEY (`id`);

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
